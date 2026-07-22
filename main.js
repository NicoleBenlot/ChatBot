const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const { spawn, exec } = require("child_process");
const http = require("http");
const fs = require("fs");
const fsp = fs.promises;

let mainWindow;
let ollamaProcess = null; // only set if THIS app started ollama serve

const OLLAMA_HOST = "127.0.0.1";
const OLLAMA_PORT = 11434;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        icon: path.join(__dirname, "favicon.ico"),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile("chatbot.html");

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    mainWindow.webContents.on("preload-error", (event, preloadPath, error) => {
        console.error("Preload script failed:", preloadPath, error);
        sendStatus("Preload script failed to load: " + error.message, { error: true });
    });

    mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        // -3 is a benign "aborted" code (e.g. a superseded navigation), ignore it
        if (!isMainFrame || errorCode === -3) return;
        console.error("Page failed to load:", errorCode, errorDescription, validatedURL);
        sendStatus("Interface failed to load (" + errorDescription + ").", { error: true });
    });

    return mainWindow;
}

function sendStatus(message, extra = {}) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const payload = { message, ...extra };

    // Primary path: IPC to the preload bridge.
    mainWindow.webContents.send("ollama-status", payload);

    // Fallback path: inject directly into the page. This works even if
    // the preload script failed to load for some reason, since it runs
    // in the page's own world rather than depending on contextBridge.
    const js = `window.__applyOllamaStatus && window.__applyOllamaStatus(${JSON.stringify(payload)});`;
    mainWindow.webContents.executeJavaScript(js).catch(() => {});
}

// Quick ping to see if something is already answering on Ollama's port
function checkServerUp() {
    return new Promise((resolve) => {
        const req = http.get(
            { host: OLLAMA_HOST, port: OLLAMA_PORT, path: "/", timeout: 1500 },
            (res) => {
                res.resume();
                resolve(res.statusCode === 200);
            }
        );
        req.on("error", () => resolve(false));
        req.on("timeout", () => {
            req.destroy();
            resolve(false);
        });
    });
}

// Where Ollama typically lands if it's installed but not (yet) on PATH.
// GUI-launched apps on Windows especially can end up with a stale PATH
// that doesn't include it, even though a terminal would find it fine.
function fallbackOllamaPaths() {
    if (process.platform === "win32") {
        const localAppData = process.env.LOCALAPPDATA || "";
        return [path.join(localAppData, "Programs", "Ollama", "ollama.exe")];
    }
    if (process.platform === "darwin") {
        return [
            "/usr/local/bin/ollama",
            "/opt/homebrew/bin/ollama",
            "/Applications/Ollama.app/Contents/Resources/ollama"
        ];
    }
    return ["/usr/local/bin/ollama", "/usr/bin/ollama"];
}

// Resolves the ollama command to run. Returns a command string (either
// "ollama" if it's on PATH, or an absolute path found as a fallback),
// or null if it can't be found anywhere.
function resolveOllamaCommand() {
    return new Promise((resolve) => {
        const cmd = process.platform === "win32" ? "where ollama" : "which ollama";
        exec(cmd, (err, stdout) => {
            if (!err && stdout && stdout.trim()) {
                resolve(stdout.trim().split(/\r?\n/)[0]);
                return;
            }
            const fallback = fallbackOllamaPaths().find((p) => {
                try {
                    return fs.existsSync(p);
                } catch (e) {
                    return false;
                }
            });
            resolve(fallback || null);
        });
    });
}

function waitForServer(timeoutMs = 30000, intervalMs = 500) {
    return new Promise((resolve) => {
        const start = Date.now();
        (async function poll() {
            const up = await checkServerUp();
            if (up) return resolve(true);
            if (Date.now() - start > timeoutMs) return resolve(false);
            setTimeout(poll, intervalMs);
        })();
    });
}

function startOllamaServe(command) {
    sendStatus("Starting Ollama server…");
    const child = spawn(command, ["serve"], {
        // On Windows we don't detach (taskkill /t handles the tree).
        // On mac/linux we detach so the child becomes its own process
        // group leader, which lets us kill the whole group on quit.
        detached: process.platform !== "win32",
        windowsHide: true
    });

    ollamaProcess = child;

    child.on("error", (err) => {
        sendStatus("Couldn't start Ollama: " + err.message, { error: true });
        ollamaProcess = null;
    });

    child.on("exit", () => {
        if (ollamaProcess === child) ollamaProcess = null;
    });

    // We don't need the output, but draining it avoids the pipe filling up
    child.stdout && child.stdout.on("data", () => {});
    child.stderr && child.stderr.on("data", () => {});
}

function killOllama() {
    if (!ollamaProcess || ollamaProcess.killed) return;
    const pid = ollamaProcess.pid;
    try {
        if (process.platform === "win32") {
            // /t kills the whole process tree, since `ollama serve`
            // can spawn child processes for model runners
            spawn("taskkill", ["/pid", String(pid), "/t", "/f"]);
        } else {
            process.kill(-pid, "SIGTERM");
        }
    } catch (e) {
        // process may already be gone, ignore
    }
    ollamaProcess = null;
}

async function initOllama() {
    try {
        sendStatus("Checking for Ollama…");
        const command = await resolveOllamaCommand();
        if (!command) {
            sendStatus(
                "Ollama isn't installed (or isn't on PATH). Install it from ollama.com, then click Retry.",
                { error: true }
            );
            return;
        }

        sendStatus("Checking if Ollama server is running…");
        let up = await checkServerUp();

        if (!up) {
            startOllamaServe(command);
            sendStatus("Waiting for Ollama server to start…");
            up = await waitForServer();
        }

        if (up) {
            sendStatus("Ollama server running", { ready: true });
        } else {
            sendStatus(
                "Ollama server didn't start in time. Check your Ollama installation.",
                { error: true }
            );
        }
    } catch (err) {
        console.error("initOllama failed:", err);
        sendStatus("Unexpected error starting Ollama: " + err.message, { error: true });
    }
}

// Renderer can ask us to retry after an error (e.g. user just installed Ollama)
ipcMain.on("retry-ollama-check", () => {
    initOllama();
});

// ---------------------------------------------------------------------
// Conversation history & settings — stored as plain JSON files under
// the app's userData folder, e.g. %APPDATA%\ChatBot\conversations\*.json
// on Windows. Keeping this dependency-free (no SQLite/native modules)
// on purpose, since native modules need rebuilding per Electron version
// and this app has already had enough packaging headaches.
// ---------------------------------------------------------------------

function conversationsDir() {
    return path.join(app.getPath("userData"), "conversations");
}

function settingsFile() {
    return path.join(app.getPath("userData"), "settings.json");
}

async function ensureConversationsDir() {
    const dir = conversationsDir();
    await fsp.mkdir(dir, { recursive: true });
    return dir;
}

// Conversation ids are always generated by us, but sanitize anyway
// before building a filesystem path out of one.
function safeId(id) {
    return String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
}

ipcMain.handle("history:list", async () => {
    const dir = await ensureConversationsDir();
    const files = await fsp.readdir(dir);
    const conversations = [];
    for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
            const raw = await fsp.readFile(path.join(dir, file), "utf-8");
            const data = JSON.parse(raw);
            conversations.push({
                id: data.id,
                title: data.title || "New chat",
                updatedAt: data.updatedAt || data.createdAt || 0
            });
        } catch (e) {
            // skip unreadable/corrupt file rather than failing the whole list
        }
    }
    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return conversations;
});

ipcMain.handle("history:load", async (event, id) => {
    const dir = conversationsDir();
    const raw = await fsp.readFile(path.join(dir, safeId(id) + ".json"), "utf-8");
    return JSON.parse(raw);
});

ipcMain.handle("history:save", async (event, conversation) => {
    const dir = await ensureConversationsDir();
    if (!conversation.id) {
        conversation.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        conversation.createdAt = new Date().toISOString();
    }
    conversation.updatedAt = new Date().toISOString();
    await fsp.writeFile(
        path.join(dir, safeId(conversation.id) + ".json"),
        JSON.stringify(conversation, null, 2),
        "utf-8"
    );
    return conversation;
});

ipcMain.handle("history:delete", async (event, id) => {
    const dir = conversationsDir();
    try {
        await fsp.unlink(path.join(dir, safeId(id) + ".json"));
    } catch (e) {
        // already gone, ignore
    }
    return true;
});

ipcMain.handle("settings:load", async () => {
    try {
        const raw = await fsp.readFile(settingsFile(), "utf-8");
        return JSON.parse(raw);
    } catch (e) {
        return {};
    }
});

ipcMain.handle("settings:save", async (event, settings) => {
    await fsp.writeFile(settingsFile(), JSON.stringify(settings, null, 2), "utf-8");
    return true;
});

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();

    mainWindow.webContents.once("did-finish-load", () => {
        initOllama();
    });

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    killOllama();
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("before-quit", () => {
    killOllama();
});
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn, exec } = require("child_process");
const http = require("http");

let mainWindow;
let ollamaProcess = null; // only set if THIS app started ollama serve

const OLLAMA_HOST = "127.0.0.1";
const OLLAMA_PORT = 11434;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
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

    return mainWindow;
}

function sendStatus(message, extra = {}) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("ollama-status", { message, ...extra });
    }
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

// Is the `ollama` executable available on PATH at all?
function checkOllamaInstalled() {
    return new Promise((resolve) => {
        const cmd = process.platform === "win32" ? "where ollama" : "which ollama";
        exec(cmd, (err) => resolve(!err));
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

function startOllamaServe() {
    sendStatus("Starting Ollama server…");
    const child = spawn("ollama", ["serve"], {
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
    sendStatus("Checking for Ollama…");
    const installed = await checkOllamaInstalled();
    if (!installed) {
        sendStatus(
            "Ollama isn't installed. Install it from ollama.com, then restart the app.",
            { error: true }
        );
        return;
    }

    sendStatus("Checking if Ollama server is running…");
    let up = await checkServerUp();

    if (!up) {
        startOllamaServe();
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
}

// Renderer can ask us to retry after an error (e.g. user just installed Ollama)
ipcMain.on("retry-ollama-check", () => {
    initOllama();
});

app.whenReady().then(() => {
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
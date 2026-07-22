const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ollamaBridge", {
    onStatus: (callback) => {
        ipcRenderer.on("ollama-status", (_event, data) => callback(data));
    },
    retry: () => ipcRenderer.send("retry-ollama-check")
});

contextBridge.exposeInMainWorld("historyBridge", {
    list: () => ipcRenderer.invoke("history:list"),
    load: (id) => ipcRenderer.invoke("history:load", id),
    save: (conversation) => ipcRenderer.invoke("history:save", conversation),
    delete: (id) => ipcRenderer.invoke("history:delete", id)
});

contextBridge.exposeInMainWorld("settingsBridge", {
    load: () => ipcRenderer.invoke("settings:load"),
    save: (settings) => ipcRenderer.invoke("settings:save", settings)
});
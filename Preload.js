const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ollamaBridge", {
    onStatus: (callback) => {
        ipcRenderer.on("ollama-status", (_event, data) => callback(data));
    },
    retry: () => ipcRenderer.send("retry-ollama-check")
});
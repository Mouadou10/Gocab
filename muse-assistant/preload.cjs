const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("museAPI", {
  ask: (prompt) => ipcRenderer.invoke("agent:ask", prompt),
  clearMemory: () => ipcRenderer.invoke("agent:clear"),
  getContextStats: () => ipcRenderer.invoke("agent:stats"),
  resizePill: (expanded) => ipcRenderer.send("pill:resize", expanded),
  toggleFollowClicks: (enabled) => ipcRenderer.invoke("agent:follow-clicks", enabled),
  closeApp: () => ipcRenderer.send("pill:close"),
  onStatus: (cb) => {
    const handler = (_event, payload) => cb(payload);
    ipcRenderer.on("agent:status", handler);
    return () => ipcRenderer.removeListener("agent:status", handler);
  },
  onHotkeyToggle: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("hotkey:toggle-mic", handler);
    return () => ipcRenderer.removeListener("hotkey:toggle-mic", handler);
  },
});

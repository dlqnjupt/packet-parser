const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  parseStats: (data) => ipcRenderer.invoke('parse-stats', data),
  getStats: () => ipcRenderer.invoke('get-stats'),
});

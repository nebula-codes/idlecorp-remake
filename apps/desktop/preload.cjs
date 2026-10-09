const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('idlecorp', Object.freeze({
  getServerOrigin: () => ipcRenderer.invoke('connection:get'),
  setServerOrigin: (origin) => ipcRenderer.invoke('connection:set', origin),
}));

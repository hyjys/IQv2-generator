const { contextBridge, ipcRenderer } = require('electron');

// Keep filesystem and Electron objects in the main process. Every call is
// checked again there, including calls from a compromised renderer.
contextBridge.exposeInMainWorld('desktop', Object.freeze({
  openDocument: () => ipcRenderer.invoke('document:open'),
  saveDocument: (options) => ipcRenderer.invoke('document:save', options),
  chooseImage: () => ipcRenderer.invoke('image:open'),
  exportPdf: (options) => ipcRenderer.invoke('document:pdf', options),
  appInfo: () => ipcRenderer.invoke('app:info'),
  openService: (options) => ipcRenderer.invoke('service:open', options),
}));

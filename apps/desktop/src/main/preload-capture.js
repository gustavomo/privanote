const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('captureApi', {
  startSession: () => ipcRenderer.invoke('capture:start-session'),
  stopSession: () => ipcRenderer.invoke('capture:stop-session'),
  getSessionState: () => ipcRenderer.invoke('capture:get-state'),
  onStateChange: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('capture:state-changed', handler);
    return () => ipcRenderer.removeListener('capture:state-changed', handler);
  },
  startClipboard: () => ipcRenderer.invoke('clipboard:start-session'),
  stopClipboard: () => ipcRenderer.invoke('clipboard:stop-session'),
  getClipboardState: () => ipcRenderer.invoke('clipboard:get-state'),
  onClipboardStateChange: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('clipboard:state-changed', handler);
    return () => ipcRenderer.removeListener('clipboard:state-changed', handler);
  },
  onClipboardCount: (callback) => {
    const handler = (_event, count) => callback(count);
    ipcRenderer.on('clipboard:count-changed', handler);
    return () => ipcRenderer.removeListener('clipboard:count-changed', handler);
  },
});

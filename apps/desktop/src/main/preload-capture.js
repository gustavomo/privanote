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
});

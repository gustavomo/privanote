const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('avatarAPI', {
  speak: (text) => ipcRenderer.invoke('avatar:speak', text),
});

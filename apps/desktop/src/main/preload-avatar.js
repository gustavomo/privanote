const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('avatarAPI', {
  speak:          (text)   => ipcRenderer.invoke('avatar:speak', text),
  setIgnoreMouse: (ignore) => ipcRenderer.send('avatar:set-ignore-mouse', ignore),
  moveTo:         (x, y)   => ipcRenderer.send('overlay:move', { windowName: 'avatar', x, y }),
  getBounds:      ()       => ipcRenderer.invoke('overlay:get-bounds', 'avatar'),
});

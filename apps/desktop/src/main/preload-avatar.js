const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('avatarAPI', {
  speak:          (text)     => ipcRenderer.invoke('avatar:speak', text),
  setIgnoreMouse: (ignore)   => ipcRenderer.send('avatar:set-ignore-mouse', ignore),
  getBounds:      ()         => ipcRenderer.invoke('overlay:get-bounds', 'avatar'),
  moveBy:         (dx, dy)   => ipcRenderer.send('avatar:move-by', { dx, dy }),
});

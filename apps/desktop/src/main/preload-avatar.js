const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('avatarAPI', {
  speak:          (text)   => ipcRenderer.invoke('avatar:speak', text),
  setIgnoreMouse: (ignore) => ipcRenderer.send('avatar:set-ignore-mouse', ignore),
  getBounds:      ()       => ipcRenderer.invoke('overlay:get-bounds', 'avatar'),
  onWalk: (cb) => {
    const handler = (_e, dir) => cb(dir);
    ipcRenderer.on('avatar:walk', handler);
    return () => ipcRenderer.removeListener('avatar:walk', handler);
  },
});

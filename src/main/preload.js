const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Methods for renderer can be added here
});

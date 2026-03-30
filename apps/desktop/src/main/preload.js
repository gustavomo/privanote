const { contextBridge, ipcRenderer } = require('electron');
const { createBackendClient } = require('../lib/backend-client');

function createIpcTransport() {
  return {
    request(operation, payload) {
      return ipcRenderer.invoke('backend:request', {
        operationId: operation.id,
        payload,
      });
    },
  };
}

const backendClient = createBackendClient({
  transport: createIpcTransport(),
});

contextBridge.exposeInMainWorld('api', {
  ...backendClient,
  pickFile: () => ipcRenderer.invoke('files:pick'),
});

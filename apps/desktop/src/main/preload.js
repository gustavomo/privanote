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
    upload(operation, payload, file) {
      return ipcRenderer.invoke('backend:upload', {
        operationId: operation.id,
        payload,
        fileName: file?.fileName,
        mimeType: file?.mimeType,
        bytes: file?.bytes,
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
  getAttachmentContentUrl: (attachmentId) =>
    ipcRenderer.invoke('attachments:get-content-url', attachmentId),
  openPath: (localPath) => ipcRenderer.invoke('files:open-path', localPath),
  getMediaAccessStatus: (mediaType) => ipcRenderer.invoke('media:get-access-status', mediaType),
  requestMediaAccess: (mediaType) => ipcRenderer.invoke('media:request-access', mediaType),
});

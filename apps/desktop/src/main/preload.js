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
  onCaptureNoteCreated: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('capture:note-created', handler);
    return () => ipcRenderer.removeListener('capture:note-created', handler);
  },
  onCallRecordingStart: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('call-recording:trigger-start', handler);
    return () => ipcRenderer.removeListener('call-recording:trigger-start', handler);
  },
  onCallRecordingStop: (callback) => {
    const handler = (_event) => callback();
    ipcRenderer.on('call-recording:trigger-stop', handler);
    return () => ipcRenderer.removeListener('call-recording:trigger-stop', handler);
  },
  sendCallRecordingCompleted: (result) => {
    ipcRenderer.send('call-recording:completed', result);
  },
  saveTempBlob: (data, filename) => {
    return ipcRenderer.invoke('call-recording:save-temp', { data: Array.from(data), filename });
  },
  pickFile: () => ipcRenderer.invoke('files:pick'),
  pickDirectory: () => ipcRenderer.invoke('files:pick-directory'),
  getAttachmentContentUrl: (attachmentId) =>
    ipcRenderer.invoke('attachments:get-content-url', attachmentId),
  openPath: (localPath) => ipcRenderer.invoke('files:open-path', localPath),
  openExternalUrl: (url) => ipcRenderer.invoke('shell:open-external', url),
  getMediaAccessStatus: (mediaType) => ipcRenderer.invoke('media:get-access-status', mediaType),
  requestMediaAccess: (mediaType) => ipcRenderer.invoke('media:request-access', mediaType),
  getScreenPermissionStatus: () => ipcRenderer.invoke('media:get-screen-status'),
  recordScreenDenial: () => ipcRenderer.invoke('media:record-screen-denial'),
  getCaptureAppPresets: () => ipcRenderer.invoke('capture-apps:get-presets'),
  getCaptureApps: () => ipcRenderer.invoke('capture-apps:get'),
  updateCaptureApps: (whitelist) => ipcRenderer.invoke('capture-apps:update', whitelist),
});

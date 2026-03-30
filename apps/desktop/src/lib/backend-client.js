const { v1 } = require('@privanote/backend/contracts');

function assertTransport(transport) {
  if (!transport || typeof transport.request !== 'function') {
    throw new Error('createBackendClient requires a transport with request(operation, payload).');
  }

  return transport;
}

function createBackendClient({ transport }) {
  const activeTransport = assertTransport(transport);
  const upload = (operation, payload, file) => {
    if (typeof activeTransport.upload !== 'function') {
      throw new Error('createBackendClient transport must support upload(operation, payload, file).');
    }

    return activeTransport.upload(operation, payload, file);
  };

  return {
    listNodes: () => activeTransport.request(v1.operations.listNodes),
    createNode: (payload) => activeTransport.request(v1.operations.createNode, payload),
    updateNode: (payload) => activeTransport.request(v1.operations.updateNode, payload),
    deleteNode: (nodeId) => activeTransport.request(v1.operations.deleteNode, { nodeId }),
    getSettings: () => activeTransport.request(v1.operations.getSettings),
    updateSettings: (payload) => activeTransport.request(v1.operations.updateSettings, payload),
    listAttachments: (nodeId) => activeTransport.request(v1.operations.listAttachments, { nodeId }),
    addAttachment: (payload) => activeTransport.request(v1.operations.addAttachment, payload),
    deleteAttachment: (attachmentId) =>
      activeTransport.request(v1.operations.deleteAttachment, { attachmentId }),
    saveRecording: (payload, file) => upload(v1.media.saveRecording, payload, file),
    importMedia: (payload) => activeTransport.request(v1.media.importMedia, payload),
  };
}

module.exports = {
  createBackendClient,
};

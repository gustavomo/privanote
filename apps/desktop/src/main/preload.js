const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listNodes: () => ipcRenderer.invoke('backend:request', { operationId: 'v1.nodes.listNodes' }),
  createNode: (payload) =>
    ipcRenderer.invoke('backend:request', { operationId: 'v1.nodes.createNode', payload }),
  updateNode: (payload) =>
    ipcRenderer.invoke('backend:request', { operationId: 'v1.nodes.updateNode', payload }),
  deleteNode: (nodeId) =>
    ipcRenderer.invoke('backend:request', {
      operationId: 'v1.nodes.deleteNode',
      payload: { nodeId },
    }),
  listAttachments: (nodeId) =>
    ipcRenderer.invoke('backend:request', {
      operationId: 'v1.attachments.listAttachments',
      payload: { nodeId },
    }),
  addAttachment: (payload) =>
    ipcRenderer.invoke('backend:request', {
      operationId: 'v1.attachments.addAttachment',
      payload,
    }),
  deleteAttachment: (attachmentId) =>
    ipcRenderer.invoke('backend:request', {
      operationId: 'v1.attachments.deleteAttachment',
      payload: { attachmentId },
    }),
  pickFile: () => ipcRenderer.invoke('files:pick'),
});

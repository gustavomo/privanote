const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listNodes: () => ipcRenderer.invoke('nodes:list'),
  createNode: (payload) => ipcRenderer.invoke('nodes:create', payload),
  updateNode: (payload) => ipcRenderer.invoke('nodes:update', payload),
  deleteNode: (nodeId) => ipcRenderer.invoke('nodes:delete', nodeId),

  listAttachments: (nodeId) => ipcRenderer.invoke('attachments:list', nodeId),
  addAttachment: (payload) => ipcRenderer.invoke('attachments:add', payload),
  deleteAttachment: (attachmentId) => ipcRenderer.invoke('attachments:delete', attachmentId),

  pickFile: () => ipcRenderer.invoke('files:pick'),
});

const attachments = {
  listAttachments: {
    id: 'v1.attachments.listAttachments',
    method: 'GET',
    path: '/api/v1/nodes/:nodeId/attachments',
  },
  addAttachment: {
    id: 'v1.attachments.addAttachment',
    method: 'POST',
    path: '/api/v1/nodes/:nodeId/attachments',
  },
  deleteAttachment: {
    id: 'v1.attachments.deleteAttachment',
    method: 'DELETE',
    path: '/api/v1/attachments/:attachmentId',
  },
  getAttachmentContent: {
    id: 'v1.attachments.getAttachmentContent',
    method: 'GET',
    path: '/api/v1/attachments/:attachmentId/content',
  },
};

module.exports = {
  attachments,
};

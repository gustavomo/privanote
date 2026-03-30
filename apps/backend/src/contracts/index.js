const { nodes } = require('./v1/nodes');
const { attachments } = require('./v1/attachments');
const { media } = require('./v1/media');

const operations = {
  listNodes: nodes.listNodes,
  createNode: nodes.createNode,
  updateNode: nodes.updateNode,
  deleteNode: nodes.deleteNode,
  listAttachments: attachments.listAttachments,
  addAttachment: attachments.addAttachment,
  deleteAttachment: attachments.deleteAttachment,
  saveRecording: media.saveRecording,
  importMedia: media.importMedia,
};

const v1 = {
  version: 'v1',
  nodes,
  attachments,
  media,
  operations,
};

module.exports = {
  v1,
};

const { nodes } = require('./v1/nodes');
const { attachments } = require('./v1/attachments');

const operations = {
  listNodes: nodes.listNodes,
  createNode: nodes.createNode,
  updateNode: nodes.updateNode,
  deleteNode: nodes.deleteNode,
  listAttachments: attachments.listAttachments,
  addAttachment: attachments.addAttachment,
  deleteAttachment: attachments.deleteAttachment,
};

const v1 = {
  version: 'v1',
  nodes,
  attachments,
  operations,
};

module.exports = {
  v1,
};

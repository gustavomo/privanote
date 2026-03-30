const { nodes } = require('./v1/nodes');
const { attachments } = require('./v1/attachments');
const { media } = require('./v1/media');
const { transcripts } = require('./v1/transcripts');

const operations = {
  listNodes: nodes.listNodes,
  createNode: nodes.createNode,
  updateNode: nodes.updateNode,
  deleteNode: nodes.deleteNode,
  listAttachments: attachments.listAttachments,
  addAttachment: attachments.addAttachment,
  deleteAttachment: attachments.deleteAttachment,
  getAttachmentContent: attachments.getAttachmentContent,
  saveRecording: media.saveRecording,
  importMedia: media.importMedia,
  getNoteTranscript: transcripts.getNoteTranscript,
};

const v1 = {
  version: 'v1',
  nodes,
  attachments,
  media,
  transcripts,
  operations,
};

module.exports = {
  v1,
};

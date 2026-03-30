const transcripts = {
  getNoteTranscript: {
    id: 'v1.transcripts.getNoteTranscript',
    method: 'GET',
    path: '/api/v1/nodes/:nodeId/transcript',
  },
  retryNoteTranscript: {
    id: 'v1.transcripts.retryNoteTranscript',
    method: 'POST',
    path: '/api/v1/nodes/:nodeId/transcript/retry',
  },
};

module.exports = {
  transcripts,
};

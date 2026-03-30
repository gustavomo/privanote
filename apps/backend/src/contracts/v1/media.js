const media = {
  saveRecording: {
    id: 'v1.media.saveRecording',
    method: 'POST',
    path: '/api/v1/media/recordings',
  },
  importMedia: {
    id: 'v1.media.importMedia',
    method: 'POST',
    path: '/api/v1/media/imports',
  },
};

module.exports = {
  media,
};

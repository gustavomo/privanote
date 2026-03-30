const sync = {
  listProviderConnections: {
    id: 'v1.sync.listProviderConnections',
    method: 'GET',
    path: '/api/v1/sync/providers',
  },
  beginProviderConnection: {
    id: 'v1.sync.beginProviderConnection',
    method: 'POST',
    path: '/api/v1/sync/providers/:provider/connect',
  },
  disconnectProvider: {
    id: 'v1.sync.disconnectProvider',
    method: 'POST',
    path: '/api/v1/sync/providers/:provider/disconnect',
  },
  retryAttachmentSync: {
    id: 'v1.sync.retryAttachmentSync',
    method: 'POST',
    path: '/api/v1/attachments/:attachmentId/sync/retry',
  },
};

module.exports = {
  sync,
};

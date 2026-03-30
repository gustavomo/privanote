const nodes = {
  listNodes: {
    id: 'v1.nodes.listNodes',
    method: 'GET',
    path: '/api/v1/nodes',
  },
  createNode: {
    id: 'v1.nodes.createNode',
    method: 'POST',
    path: '/api/v1/nodes',
  },
  updateNode: {
    id: 'v1.nodes.updateNode',
    method: 'PUT',
    path: '/api/v1/nodes/:nodeId',
  },
  deleteNode: {
    id: 'v1.nodes.deleteNode',
    method: 'DELETE',
    path: '/api/v1/nodes/:nodeId',
  },
};

module.exports = {
  nodes,
};

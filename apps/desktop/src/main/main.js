const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');

const OPERATION_IDS = {
  listNodes: 'v1.nodes.listNodes',
  createNode: 'v1.nodes.createNode',
  updateNode: 'v1.nodes.updateNode',
  deleteNode: 'v1.nodes.deleteNode',
  listAttachments: 'v1.attachments.listAttachments',
  addAttachment: 'v1.attachments.addAttachment',
  deleteAttachment: 'v1.attachments.deleteAttachment',
};

function sanitizeNodePayload(payload = {}) {
  const result = {
    title: String(payload.title || '').trim(),
    description: String(payload.description || '').trim(),
    tags: String(payload.tags || '').trim(),
  };

  if (!result.title) {
    throw new Error('Title is required');
  }

  return result;
}

function createMockBackendState() {
  let nextNodeId = 1;
  let nextAttachmentId = 1;
  const nodes = [];
  const attachments = [];

  const listNodes = () =>
    [...nodes].sort((left, right) => {
      const leftTime = new Date(left.updated_at).getTime();
      const rightTime = new Date(right.updated_at).getTime();
      return rightTime - leftTime || right.id - left.id;
    });

  const getNode = (nodeId) => nodes.find((node) => node.id === nodeId) || null;

  const operations = {
    [OPERATION_IDS.listNodes]: () => listNodes(),
    [OPERATION_IDS.createNode]: (payload) => {
      const safePayload = sanitizeNodePayload(payload);
      const now = new Date().toISOString();
      const node = {
        id: nextNodeId++,
        ...safePayload,
        created_at: now,
        updated_at: now,
      };
      nodes.push(node);
      return node;
    },
    [OPERATION_IDS.updateNode]: (payload) => {
      const nodeId = Number(payload?.id);
      if (!Number.isInteger(nodeId) || nodeId <= 0) {
        throw new Error('A valid node id is required');
      }

      const node = getNode(nodeId);
      if (!node) {
        throw new Error('Node not found');
      }

      Object.assign(node, sanitizeNodePayload(payload), {
        updated_at: new Date().toISOString(),
      });
      return node;
    },
    [OPERATION_IDS.deleteNode]: ({ nodeId }) => {
      const safeNodeId = Number(nodeId);
      const nodeIndex = nodes.findIndex((node) => node.id === safeNodeId);
      if (nodeIndex === -1) {
        return false;
      }

      nodes.splice(nodeIndex, 1);

      for (let index = attachments.length - 1; index >= 0; index -= 1) {
        if (attachments[index].node_id === safeNodeId) {
          attachments.splice(index, 1);
        }
      }

      return true;
    },
    [OPERATION_IDS.listAttachments]: ({ nodeId }) => {
      const safeNodeId = Number(nodeId);
      return attachments
        .filter((attachment) => attachment.node_id === safeNodeId)
        .sort((left, right) => {
          const leftTime = new Date(left.created_at).getTime();
          const rightTime = new Date(right.created_at).getTime();
          return rightTime - leftTime || right.id - left.id;
        });
    },
    [OPERATION_IDS.addAttachment]: (payload = {}) => {
      const nodeId = Number(payload.nodeId);
      const kind = String(payload.kind || '').trim();
      const localPath = String(payload.localPath || '').trim();
      const cloudUrl = String(payload.cloudUrl || '').trim();

      if (!Number.isInteger(nodeId) || nodeId <= 0) {
        throw new Error('A valid node id is required');
      }

      if (!['audio', 'video', 'file'].includes(kind)) {
        throw new Error('Attachment kind must be audio, video, or file');
      }

      if (!localPath) {
        throw new Error('Attachment local path is required');
      }

      if (!getNode(nodeId)) {
        throw new Error('Node not found');
      }

      const attachment = {
        id: nextAttachmentId++,
        node_id: nodeId,
        kind,
        local_path: localPath,
        cloud_url: cloudUrl,
        created_at: new Date().toISOString(),
      };

      attachments.push(attachment);
      return attachment;
    },
    [OPERATION_IDS.deleteAttachment]: ({ attachmentId }) => {
      const safeAttachmentId = Number(attachmentId);
      const index = attachments.findIndex((attachment) => attachment.id === safeAttachmentId);
      if (index === -1) {
        return false;
      }

      attachments.splice(index, 1);
      return true;
    },
  };

  return {
    request(operationId, payload) {
      const operation = operations[operationId];
      if (!operation) {
        throw new Error(`Unsupported contract operation: ${operationId}`);
      }

      return operation(payload);
    },
  };
}

function registerIpcHandlers(backendState) {
  ipcMain.handle('backend:request', (_event, request = {}) => {
    return backendState.request(request.operationId, request.payload);
  });

  ipcMain.handle('files:pick', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select media file',
      properties: ['openFile'],
      filters: [
        {
          name: 'Media and Files',
          extensions: ['mp3', 'wav', 'm4a', 'mp4', 'mov', 'mkv', 'webm', 'txt', 'json'],
        },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
    return;
  }

  const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  win.loadURL(url);
}

app.whenReady().then(() => {
  registerIpcHandlers(createMockBackendState());
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

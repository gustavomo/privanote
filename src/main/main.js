const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const db = require('./database');

function registerIpcHandlers() {
  ipcMain.handle('nodes:list', () => db.listNodes());
  ipcMain.handle('nodes:create', (_event, payload) => db.createNode(payload));
  ipcMain.handle('nodes:update', (_event, payload) => db.updateNode(payload));
  ipcMain.handle('nodes:delete', (_event, nodeId) => db.deleteNode(nodeId));

  ipcMain.handle('attachments:list', (_event, nodeId) => db.listAttachments(nodeId));
  ipcMain.handle('attachments:add', (_event, payload) => db.addAttachment(payload));
  ipcMain.handle('attachments:delete', (_event, attachmentId) => db.deleteAttachment(attachmentId));

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
    width: 1200,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
    return;
  }

  const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'\;
  win.loadURL(url);
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

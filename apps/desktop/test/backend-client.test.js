const { v1 } = require('@privanote/backend/contracts');
const { createBackendClient } = require('../src/lib/backend-client.js');

describe('createBackendClient', () => {
  it('maps note and attachment actions onto the backend-owned contract operations', async () => {
    const transport = {
      request: vi.fn(async (operation, payload) => ({ operation, payload })),
    };
    const client = createBackendClient({ transport });

    await client.listNodes();
    await client.createNode({ title: 'Contract note' });
    await client.updateNode({ id: 7, title: 'Updated contract note' });
    await client.deleteNode(7);
    await client.getSettings();
    await client.updateSettings({
      storageDestination: 'local',
      localMediaDirectory: '/tmp/notes',
      transcriptionMode: 'local',
    });
    await client.listAttachments(7);
    await client.addAttachment({ nodeId: 7, kind: 'audio', localPath: '/tmp/audio.wav' });
    await client.deleteAttachment(11);

    expect(transport.request).toHaveBeenNthCalledWith(1, v1.operations.listNodes);
    expect(transport.request).toHaveBeenNthCalledWith(2, v1.operations.createNode, {
      title: 'Contract note',
    });
    expect(transport.request).toHaveBeenNthCalledWith(3, v1.operations.updateNode, {
      id: 7,
      title: 'Updated contract note',
    });
    expect(transport.request).toHaveBeenNthCalledWith(4, v1.operations.deleteNode, {
      nodeId: 7,
    });
    expect(transport.request).toHaveBeenNthCalledWith(5, v1.operations.getSettings);
    expect(transport.request).toHaveBeenNthCalledWith(6, v1.operations.updateSettings, {
      storageDestination: 'local',
      localMediaDirectory: '/tmp/notes',
      transcriptionMode: 'local',
    });
    expect(transport.request).toHaveBeenNthCalledWith(7, v1.operations.listAttachments, {
      nodeId: 7,
    });
    expect(transport.request).toHaveBeenNthCalledWith(8, v1.operations.addAttachment, {
      nodeId: 7,
      kind: 'audio',
      localPath: '/tmp/audio.wav',
    });
    expect(transport.request).toHaveBeenNthCalledWith(9, v1.operations.deleteAttachment, {
      attachmentId: 11,
    });
  });

  it('requires a transport with a request function', () => {
    expect(() => createBackendClient({ transport: {} })).toThrow(
      'createBackendClient requires a transport with request(operation, payload).'
    );
  });
});

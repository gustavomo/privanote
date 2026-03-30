import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/renderer/App.jsx';

function createMockApi({ nodes: initialNodes = [], pickedPath }) {
  let nextAttachmentId = 1;
  let nextNodeId = initialNodes.length + 1;
  let nodes = [...initialNodes];
  let attachments = [];

  return {
    listNodes: vi.fn(async () => [...nodes]),
    createNode: vi.fn(async (payload) => {
      const node = {
        id: nextNodeId++,
        title: payload.title,
        description: payload.description || '',
        tags: payload.tags || '',
        created_at: '2026-03-29T00:00:00.000Z',
        updated_at: '2026-03-29T00:00:00.000Z',
      };
      nodes = [node, ...nodes];
      return node;
    }),
    updateNode: vi.fn(async (payload) => {
      nodes = nodes.map((node) => (node.id === payload.id ? { ...node, ...payload } : node));
      return nodes.find((node) => node.id === payload.id);
    }),
    deleteNode: vi.fn(async (nodeId) => {
      nodes = nodes.filter((node) => node.id !== nodeId);
      attachments = attachments.filter((attachment) => attachment.node_id !== nodeId);
      return true;
    }),
    listAttachments: vi.fn(async (nodeId) =>
      attachments.filter((attachment) => attachment.node_id === nodeId)
    ),
    addAttachment: vi.fn(async () => {
      throw new Error('Legacy addAttachment should not be used.');
    }),
    deleteAttachment: vi.fn(async (attachmentId) => {
      attachments = attachments.filter((attachment) => attachment.id !== attachmentId);
      return true;
    }),
    saveRecording: vi.fn(async () => {
      throw new Error('saveRecording is not used in import tests.');
    }),
    importMedia: vi.fn(async (payload) => {
      const node =
        nodes.find((item) => item.id === payload.nodeId) ||
        (() => {
          const createdNode = {
            id: nextNodeId++,
            title: payload.title,
            description: '',
            tags: '',
            created_at: '2026-03-29T00:00:00.000Z',
            updated_at: '2026-03-29T00:00:00.000Z',
          };
          nodes = [createdNode, ...nodes];
          return createdNode;
        })();

      const attachment = {
        id: nextAttachmentId++,
        node_id: node.id,
        kind: payload.kind,
        local_path: `/managed/${payload.sourcePath.split('/').pop()}`,
        cloud_url: '',
        created_at: '2026-03-29T00:10:00.000Z',
      };

      attachments = [attachment, ...attachments];
      return {
        node,
        attachment,
      };
    }),
    getMediaAccessStatus: vi.fn(async () => 'granted'),
    requestMediaAccess: vi.fn(async () => ({ granted: true, status: 'granted' })),
    pickFile: vi.fn(async () => pickedPath),
  };
}

describe('media import flow', () => {
  it('imports files into the selected note through importMedia', async () => {
    const api = createMockApi({
      nodes: [
        {
          id: 1,
          title: 'Existing note',
          description: '',
          tags: '',
          created_at: '2026-03-29T00:00:00.000Z',
          updated_at: '2026-03-29T00:00:00.000Z',
        },
      ],
      pickedPath: '/tmp/session.mp4',
    });

    render(<App api={api} />);

    await screen.findByText('Active Note');
    fireEvent.click(screen.getByRole('button', { name: 'Import Files' }));

    await waitFor(() => {
      expect(api.importMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 1,
          kind: 'video',
          sourcePath: '/tmp/session.mp4',
        })
      );
    });

    expect(await screen.findByText('/managed/session.mp4')).toBeInTheDocument();
  });

  it('imports files without a selected note and uses the generated placeholder title path', async () => {
    const api = createMockApi({
      pickedPath: '/tmp/archive.wav',
    });

    render(<App api={api} />);

    fireEvent.click(screen.getByRole('button', { name: 'Import Files' }));

    await waitFor(() => {
      expect(api.importMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'audio',
          sourcePath: '/tmp/archive.wav',
          title: expect.stringMatching(/^Imported audio - /),
        })
      );
    });

    expect(await screen.findByText('/managed/archive.wav')).toBeInTheDocument();
  });
});

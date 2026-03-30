import React from 'react';
import { createRequire } from 'node:module';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/renderer/App.jsx';

const require = createRequire(import.meta.url);
const { createBackendClient } = require('../src/lib/backend-client.js');

function createMockTransport() {
  let nextNodeId = 1;
  let nextAttachmentId = 1;
  let nodes = [];
  let attachments = [];

  return {
    request: vi.fn(async (operation, payload = {}) => {
      switch (operation.id) {
        case 'v1.nodes.listNodes':
          return [...nodes];
        case 'v1.nodes.createNode': {
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
        }
        case 'v1.nodes.updateNode': {
          nodes = nodes.map((node) =>
            node.id === payload.id
              ? {
                  ...node,
                  title: payload.title,
                  description: payload.description || '',
                  tags: payload.tags || '',
                  updated_at: '2026-03-29T01:00:00.000Z',
                }
              : node
          );
          return nodes.find((node) => node.id === payload.id);
        }
        case 'v1.nodes.deleteNode':
          nodes = nodes.filter((node) => node.id !== payload.nodeId);
          attachments = attachments.filter((attachment) => attachment.node_id !== payload.nodeId);
          return true;
        case 'v1.attachments.listAttachments':
          return attachments.filter((attachment) => attachment.node_id === payload.nodeId);
        case 'v1.attachments.addAttachment': {
          const attachment = {
            id: nextAttachmentId++,
            node_id: payload.nodeId,
            kind: payload.kind,
            local_path: payload.localPath,
            cloud_url: payload.cloudUrl || '',
            created_at: '2026-03-29T00:05:00.000Z',
          };
          attachments = [attachment, ...attachments];
          return attachment;
        }
        case 'v1.attachments.deleteAttachment':
          attachments = attachments.filter((attachment) => attachment.id !== payload.attachmentId);
          return true;
        default:
          throw new Error(`Unsupported mock operation: ${operation.id}`);
      }
    }),
  };
}

describe('App note workspace', () => {
  it('renders the approved empty state before any notes exist', async () => {
    const api = createBackendClient({
      transport: createMockTransport(),
    });

    render(<App api={api} />);

    expect(await screen.findAllByText('Capture Your First Note')).not.toHaveLength(0);
    expect(
      screen.getAllByText(
        'Start a recording or import files to create a note and keep the media stored locally.'
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Create Note' })).toBeInTheDocument();
  });

  it('creates notes and attachments through createBackendClient without auth prompts', async () => {
    const transport = createMockTransport();
    const api = createBackendClient({ transport });

    render(<App api={api} />);

    fireEvent.change(screen.getByPlaceholderText('New note title'), {
      target: { value: 'Architecture note' },
    });
    fireEvent.change(screen.getByPlaceholderText('Description'), {
      target: { value: 'Desktop and backend communicate only through contracts.' },
    });
    fireEvent.change(screen.getByPlaceholderText('Tags'), {
      target: { value: 'phase-1,contracts' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Note' }));

    expect((await screen.findAllByText('Architecture note')).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(transport.request).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'v1.nodes.createNode' }),
        expect.objectContaining({ title: 'Architecture note' })
      );
    });

    fireEvent.change(screen.getByPlaceholderText('Local path'), {
      target: { value: '/tmp/architecture-note.wav' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Attachment' }));

    expect(await screen.findByText('/tmp/architecture-note.wav')).toBeInTheDocument();

    await waitFor(() => {
      expect(transport.request).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'v1.attachments.addAttachment' }),
        expect.objectContaining({ localPath: '/tmp/architecture-note.wav' })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Attachment' }));

    await waitFor(() => {
      expect(screen.queryByText('/tmp/architecture-note.wav')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete Note' }));

    await waitFor(() => {
      expect(screen.getAllByText('Capture Your First Note').length).toBeGreaterThan(0);
    });
  });
});

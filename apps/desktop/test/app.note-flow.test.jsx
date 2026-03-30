import React from 'react';
import { createRequire } from 'node:module';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/renderer/App.jsx';

const require = createRequire(import.meta.url);
const { createBackendClient } = require('../src/lib/backend-client.js');

function createMockTransport() {
  let nextNodeId = 1;
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

  it('creates and deletes notes through createBackendClient without auth prompts', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Delete Note' }));

    await waitFor(() => {
      expect(screen.getAllByText('Capture Your First Note').length).toBeGreaterThan(0);
    });
  });

  it('shows the active state for capture mode and workspace navigation buttons', async () => {
    const api = createBackendClient({
      transport: createMockTransport(),
    });

    render(<App api={api} />);

    const audioButton = await screen.findByRole('button', { name: 'Audio' });
    const videoWithAudioButton = screen.getByRole('button', { name: 'Video + Audio' });
    const workspaceButton = screen.getByRole('button', { name: 'Workspace' });
    const settingsButton = screen.getByRole('button', { name: 'Settings' });

    expect(audioButton.getAttribute('aria-pressed')).toBe('true');
    expect(audioButton.getAttribute('data-state')).toBe('active');
    expect(videoWithAudioButton.getAttribute('aria-pressed')).toBe('false');
    expect(videoWithAudioButton.getAttribute('data-state')).toBe('inactive');
    expect(workspaceButton.getAttribute('aria-pressed')).toBe('true');
    expect(workspaceButton.getAttribute('data-state')).toBe('active');
    expect(settingsButton.getAttribute('aria-pressed')).toBe('false');
    expect(settingsButton.getAttribute('data-state')).toBe('inactive');

    fireEvent.click(videoWithAudioButton);
    expect(videoWithAudioButton.getAttribute('aria-pressed')).toBe('true');
    expect(videoWithAudioButton.getAttribute('data-state')).toBe('active');
    expect(audioButton.getAttribute('aria-pressed')).toBe('false');
    expect(audioButton.getAttribute('data-state')).toBe('inactive');

    fireEvent.click(settingsButton);
    expect(settingsButton.getAttribute('aria-pressed')).toBe('true');
    expect(settingsButton.getAttribute('aria-current')).toBe('page');
    expect(settingsButton.getAttribute('data-state')).toBe('active');
    expect(workspaceButton.getAttribute('aria-pressed')).toBe('false');
    expect(workspaceButton.getAttribute('data-state')).toBe('inactive');

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));
    expect(screen.getByRole('button', { name: 'Workspace' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Workspace' }).getAttribute('data-state')).toBe('active');
    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('data-state')).toBe('inactive');
  });
});

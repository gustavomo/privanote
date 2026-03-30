import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/renderer/App.jsx';

function createMockApi() {
  const nodes = [
    {
      id: 1,
      title: 'Saved media note',
      description: '',
      tags: '',
      created_at: '2026-03-29T00:00:00.000Z',
      updated_at: '2026-03-29T00:00:00.000Z',
    },
  ];

  const attachments = [
    {
      id: 1,
      node_id: 1,
      kind: 'audio',
      local_path: '/managed/saved-audio.webm',
      cloud_url: '',
      created_at: '2026-03-29T00:05:00.000Z',
    },
    {
      id: 2,
      node_id: 1,
      kind: 'video',
      local_path: '/managed/saved-video.webm',
      cloud_url: '',
      created_at: '2026-03-29T00:06:00.000Z',
    },
    {
      id: 3,
      node_id: 1,
      kind: 'file',
      local_path: '/managed/meeting-notes.txt',
      cloud_url: '',
      created_at: '2026-03-29T00:07:00.000Z',
    },
  ];

  return {
    listNodes: vi.fn(async () => nodes),
    createNode: vi.fn(),
    updateNode: vi.fn(async (payload) => ({ ...nodes[0], ...payload })),
    deleteNode: vi.fn(async () => true),
    listAttachments: vi.fn(async (nodeId) => attachments.filter((attachment) => attachment.node_id === nodeId)),
    addAttachment: vi.fn(),
    deleteAttachment: vi.fn(async () => true),
    saveRecording: vi.fn(),
    importMedia: vi.fn(),
    getAttachmentContentUrl: vi.fn(async (attachmentId) => `/preview/${attachmentId}`),
    openPath: vi.fn(async () => ''),
    getMediaAccessStatus: vi.fn(async () => 'granted'),
    requestMediaAccess: vi.fn(async () => ({ granted: true, status: 'granted' })),
    pickFile: vi.fn(async () => null),
  };
}

describe('saved media cards', () => {
  it('renders audio, video, and generic file cards inside the note workspace', async () => {
    const api = createMockApi();
    const { container } = render(<App api={api} />);

    await screen.findByText('Active Note');

    await waitFor(() => {
      expect(api.getAttachmentContentUrl).toHaveBeenCalledWith(1);
      expect(api.getAttachmentContentUrl).toHaveBeenCalledWith(2);
    });

    expect(container.querySelector('audio')).not.toBeNull();
    expect(container.querySelector('video')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Open File' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove Media' })).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Open File' }));

    await waitFor(() => {
      expect(api.openPath).toHaveBeenCalledWith('/managed/meeting-notes.txt');
    });
  });
});

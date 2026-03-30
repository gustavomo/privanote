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
      cloud_url: 'https://drive.google.com/media-item',
      created_at: '2026-03-29T00:05:00.000Z',
      sync_status: 'synced',
      sync_provider: 'google-drive',
      sync_error: '',
      sync_remote_url: 'https://drive.google.com/media-item',
      transcript_patch_pending: 1,
    },
    {
      id: 2,
      node_id: 1,
      kind: 'video',
      local_path: '/managed/saved-video.webm',
      cloud_url: '',
      created_at: '2026-03-29T00:06:00.000Z',
      sync_status: 'failed',
      sync_provider: 'onedrive',
      sync_error: 'Upload session expired.',
      sync_remote_url: '',
      transcript_patch_pending: 0,
    },
    {
      id: 3,
      node_id: 1,
      kind: 'file',
      local_path: '/managed/meeting-notes.txt',
      cloud_url: '',
      created_at: '2026-03-29T00:07:00.000Z',
      sync_status: 'local_only',
      sync_provider: '',
      sync_error: '',
      sync_remote_url: '',
      transcript_patch_pending: 0,
    },
  ];

  return {
    listNodes: vi.fn(async () => nodes),
    createNode: vi.fn(),
    updateNode: vi.fn(async (payload) => ({ ...nodes[0], ...payload })),
    deleteNode: vi.fn(async () => true),
    getSettings: vi.fn(async () => ({
      storageDestination: 'local',
      localMediaDirectory: '',
      transcriptionMode: 'local',
      providerKind: 'openai',
      backendApiKeyConfigured: false,
      backendApiKeyMaskedHint: '',
    })),
    updateSettings: vi.fn(async () => ({})),
    listProviderConnections: vi.fn(async () => []),
    beginProviderConnection: vi.fn(async () => ({
      authorizationUrl: 'https://auth.test/google-drive',
    })),
    disconnectProvider: vi.fn(async () => ({})),
    listAttachments: vi.fn(async (nodeId) => attachments.filter((attachment) => attachment.node_id === nodeId)),
    addAttachment: vi.fn(),
    deleteAttachment: vi.fn(async () => true),
    retryAttachmentSync: vi.fn(async () => true),
    saveRecording: vi.fn(),
    importMedia: vi.fn(),
    getAttachmentContentUrl: vi.fn(async (attachmentId) => `/preview/${attachmentId}`),
    openPath: vi.fn(async () => ''),
    openExternalUrl: vi.fn(async () => true),
    getNoteTranscript: vi.fn(async () => null),
    retryNoteTranscript: vi.fn(async () => null),
    getMediaAccessStatus: vi.fn(async () => 'granted'),
    requestMediaAccess: vi.fn(async () => ({ granted: true, status: 'granted' })),
    pickFile: vi.fn(async () => null),
    pickDirectory: vi.fn(async () => '/vault/privanote'),
  };
}

describe('saved media cards', () => {
  it('renders synced, failed, transcript-pending, and local-only card states with retry and local controls intact', async () => {
    const api = createMockApi();
    const { container } = render(<App api={api} />);

    await screen.findByText('Active Note');

    await waitFor(() => {
      expect(api.getAttachmentContentUrl).toHaveBeenCalledWith(1);
      expect(api.getAttachmentContentUrl).toHaveBeenCalledWith(2);
    });

    expect(container.querySelector('audio')).not.toBeNull();
    expect(container.querySelector('video')).not.toBeNull();
    expect(screen.getByText('Synced to Google Drive')).toBeInTheDocument();
    expect(screen.getByText('Local only')).toBeInTheDocument();
    expect(screen.getByText('Sync failed')).toBeInTheDocument();
    expect(
      screen.getByText('Media uploaded. Transcript and metadata will sync when ready.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Sync failed. Your local file is still available. Retry sync or reconnect this provider in Settings.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open File' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove Media' })).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Retry Sync' }));
    await waitFor(() => {
      expect(api.retryAttachmentSync).toHaveBeenCalledWith(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open File' }));

    await waitFor(() => {
      expect(api.openPath).toHaveBeenCalledWith('/managed/meeting-notes.txt');
    });
  });
});

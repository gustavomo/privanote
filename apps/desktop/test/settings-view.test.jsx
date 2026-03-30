import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/renderer/App.jsx';

function createMockApi() {
  let settings = {
    storageDestination: 'local',
    localMediaDirectory: '',
    transcriptionMode: 'local',
  };

  return {
    listNodes: vi.fn(async () => []),
    createNode: vi.fn(async () => {
      throw new Error('Not used in settings tests.');
    }),
    updateNode: vi.fn(async () => {
      throw new Error('Not used in settings tests.');
    }),
    deleteNode: vi.fn(async () => true),
    listAttachments: vi.fn(async () => []),
    addAttachment: vi.fn(async () => {
      throw new Error('Not used in settings tests.');
    }),
    deleteAttachment: vi.fn(async () => true),
    saveRecording: vi.fn(async () => {
      throw new Error('Not used in settings tests.');
    }),
    importMedia: vi.fn(async () => {
      throw new Error('Not used in settings tests.');
    }),
    getAttachmentContentUrl: vi.fn(async () => '/preview/1'),
    openPath: vi.fn(async () => ''),
    getSettings: vi.fn(async () => ({ ...settings })),
    updateSettings: vi.fn(async (payload) => {
      settings = {
        ...settings,
        ...payload,
      };
      return { ...settings };
    }),
    getMediaAccessStatus: vi.fn(async () => 'granted'),
    requestMediaAccess: vi.fn(async () => ({ granted: true, status: 'granted' })),
    pickFile: vi.fn(async () => null),
    pickDirectory: vi.fn(async () => '/vault/settings-media'),
  };
}

describe('settings view', () => {
  it('loads persisted settings, saves storage and transcription changes, and reloads them on a fresh render', async () => {
    const api = createMockApi();

    const { unmount } = render(<App api={api} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));

    expect(await screen.findByRole('heading', { name: 'Storage' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Folder' }));
    await waitFor(() => {
      expect(screen.getByDisplayValue('/vault/settings-media')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Backend'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => {
      expect(api.updateSettings).toHaveBeenCalledWith({
        storageDestination: 'local',
        localMediaDirectory: '/vault/settings-media',
        transcriptionMode: 'backend',
      });
    });

    unmount();
    render(<App api={api} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('/vault/settings-media')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Backend')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument();
  });
});

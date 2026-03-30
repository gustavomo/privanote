import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/renderer/App.jsx';

function createMockApi() {
  let settings = {
    storageDestination: 'local',
    localMediaDirectory: '',
    transcriptionMode: 'local',
    providerKind: 'openai',
    backendApiKeyConfigured: false,
    backendApiKeyMaskedHint: '',
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
      if (payload.backendApiKey === 'bad-key') {
        throw new Error('OpenAI API key is invalid.');
      }

      settings = {
        ...settings,
        ...payload,
        backendApiKeyConfigured: Boolean(payload.backendApiKey) || settings.backendApiKeyConfigured,
        backendApiKeyMaskedHint: payload.backendApiKey
          ? `••••${payload.backendApiKey.slice(-4)}`
          : settings.backendApiKeyMaskedHint,
      };

      if (payload.clearBackendApiKey) {
        settings.backendApiKeyConfigured = false;
        settings.backendApiKeyMaskedHint = '';
      }

      return { ...settings };
    }),
    getNoteTranscript: vi.fn(async () => null),
    retryNoteTranscript: vi.fn(async () => null),
    getMediaAccessStatus: vi.fn(async () => 'granted'),
    requestMediaAccess: vi.fn(async () => ({ granted: true, status: 'granted' })),
    pickFile: vi.fn(async () => null),
    pickDirectory: vi.fn(async () => '/vault/settings-media'),
  };
}

describe('settings view', () => {
  it('loads persisted settings, saves backend provider settings, and reloads masked provider state on a fresh render', async () => {
    const api = createMockApi();

    const { unmount } = render(<App api={api} />);

    const settingsButton = await screen.findByRole('button', { name: 'Settings' });
    const workspaceButton = screen.getByRole('button', { name: 'Workspace' });
    expect(workspaceButton).toHaveAttribute('aria-pressed', 'true');
    expect(workspaceButton).toHaveAttribute('data-state', 'active');
    expect(settingsButton).toHaveAttribute('aria-pressed', 'false');
    expect(settingsButton).toHaveAttribute('data-state', 'inactive');

    fireEvent.click(settingsButton);
    expect(settingsButton).toHaveAttribute('aria-pressed', 'true');
    expect(settingsButton).toHaveAttribute('data-state', 'active');
    expect(workspaceButton).toHaveAttribute('aria-pressed', 'false');
    expect(workspaceButton).toHaveAttribute('data-state', 'inactive');

    expect(await screen.findByRole('heading', { name: 'Storage' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Folder' }));
    await waitFor(() => {
      expect(screen.getByDisplayValue('/vault/settings-media')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Backend'));
    fireEvent.change(screen.getByLabelText('OpenAI API Key'), {
      target: {
        value: 'sk-test-1234',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => {
      expect(api.updateSettings).toHaveBeenCalledWith({
        storageDestination: 'local',
        localMediaDirectory: '/vault/settings-media',
        transcriptionMode: 'backend',
        providerKind: 'openai',
        backendApiKey: 'sk-test-1234',
        clearBackendApiKey: false,
      });
    });

    unmount();
    render(<App api={api} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('/vault/settings-media')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Backend')).toBeChecked();
    expect(screen.getByText('Saved key: ••••1234')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Provider' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workspace' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Workspace' })).toHaveAttribute('data-state', 'inactive');
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument();
  });

  it("shows the exact settings validation copy when a backend-mode save fails", async () => {
    const api = createMockApi();

    render(<App api={api} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByLabelText('Backend'));
    fireEvent.change(screen.getByLabelText('OpenAI API Key'), {
      target: {
        value: 'bad-key',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    expect(
      await screen.findByText("We couldn't save these settings. Fix the highlighted fields and try again.")
    ).toBeInTheDocument();
  });
});

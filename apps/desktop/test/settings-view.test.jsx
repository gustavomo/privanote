import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/renderer/App.jsx';

function createMockApi({
  initialSettings = {
    storageDestination: 'local',
    localMediaDirectory: '',
    transcriptionMode: 'local',
    providerKind: 'openai',
    backendApiKeyConfigured: false,
    backendApiKeyMaskedHint: '',
  },
  initialProviderConnections = [
    {
      provider: 'google-drive',
      connectionStatus: 'disconnected',
      accountLabel: '',
      rootFolderId: '',
      rootFolderUrl: '',
      connectedAt: null,
      lastError: '',
    },
    {
      provider: 'onedrive',
      connectionStatus: 'disconnected',
      accountLabel: '',
      rootFolderId: '',
      rootFolderUrl: '',
      connectedAt: null,
      lastError: '',
    },
  ],
} = {}) {
  let settings = {
    ...initialSettings,
  };
  let providerConnections = initialProviderConnections.map((connection) => ({ ...connection }));

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
    openExternalUrl: vi.fn(async () => true),
    getSettings: vi.fn(async () => ({ ...settings })),
    updateSettings: vi.fn(async (payload) => {
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
    listProviderConnections: vi.fn(async () => providerConnections.map((connection) => ({ ...connection }))),
    beginProviderConnection: vi.fn(async (provider) => {
      providerConnections = providerConnections.map((connection) =>
        connection.provider === provider
          ? {
              ...connection,
              connectionStatus: 'pending',
            }
          : connection
      );
      return {
        provider,
        connectionStatus: 'pending',
        authorizationUrl: `https://auth.test/${provider}`,
      };
    }),
    disconnectProvider: vi.fn(async (provider) => {
      providerConnections = providerConnections.map((connection) =>
        connection.provider === provider
          ? {
              ...connection,
              connectionStatus: 'disconnected',
              accountLabel: '',
            }
          : connection
      );
      return providerConnections.find((connection) => connection.provider === provider);
    }),
    getNoteTranscript: vi.fn(async () => null),
    retryNoteTranscript: vi.fn(async () => null),
    retryAttachmentSync: vi.fn(async () => null),
    getMediaAccessStatus: vi.fn(async () => 'granted'),
    requestMediaAccess: vi.fn(async () => ({ granted: true, status: 'granted' })),
    pickFile: vi.fn(async () => null),
    pickDirectory: vi.fn(async () => '/vault/settings-media'),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('settings view', () => {
  it('shows both connected providers with one default destination and supports disconnect confirmation', async () => {
    const api = createMockApi({
      initialSettings: {
        storageDestination: 'google-drive',
        localMediaDirectory: '/vault/settings-media',
        transcriptionMode: 'local',
        providerKind: 'openai',
        backendApiKeyConfigured: false,
        backendApiKeyMaskedHint: '',
      },
      initialProviderConnections: [
        {
          provider: 'google-drive',
          connectionStatus: 'connected',
          accountLabel: 'google@example.com',
          rootFolderId: 'google-root',
          rootFolderUrl: 'https://drive.google.com/root',
          connectedAt: '2026-03-30T00:00:00.000Z',
          lastError: '',
        },
        {
          provider: 'onedrive',
          connectionStatus: 'connected',
          accountLabel: 'onedrive@example.com',
          rootFolderId: 'onedrive-root',
          rootFolderUrl: 'https://onedrive.live.com/root',
          connectedAt: '2026-03-30T00:00:00.000Z',
          lastError: '',
        },
      ],
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App api={api} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));

    expect(await screen.findByRole('heading', { name: 'Cloud sync' })).toBeInTheDocument();
    expect(screen.getByText('google@example.com')).toBeInTheDocument();
    expect(screen.getByText('onedrive@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Connected')).toHaveLength(2);
    expect(screen.getAllByText('Default destination').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Future saves and older unsynced local media will queue to the selected destination. Already-synced items stay where they are.'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect OneDrive' }));

    expect(window.confirm).toHaveBeenCalledWith(
      'Disconnect Provider: Remove this provider connection from Privanote? Existing remote files stay in your account, and local attachments remain available here.'
    );
    await waitFor(() => {
      expect(api.disconnectProvider).toHaveBeenCalledWith('onedrive');
    });
  });

  it('launches provider connect in the browser and blocks saving a disconnected cloud destination', async () => {
    const api = createMockApi();

    render(<App api={api} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect Google Drive' }));

    await waitFor(() => {
      expect(api.beginProviderConnection).toHaveBeenCalledWith('google-drive');
      expect(api.openExternalUrl).toHaveBeenCalledWith('https://auth.test/google-drive');
    });

    fireEvent.click(screen.getByLabelText('OneDrive'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    expect(api.updateSettings).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Connect OneDrive before saving it as the default destination.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect OneDrive' })).toBeInTheDocument();
  });
});

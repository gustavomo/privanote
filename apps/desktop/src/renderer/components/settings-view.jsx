import React from 'react';

const storageOptions = [
  { value: 'local', label: 'Local' },
  { value: 'google-drive', label: 'Google Drive' },
  { value: 'onedrive', label: 'OneDrive' },
];

const transcriptionOptions = [
  { value: 'local', label: 'Local' },
  { value: 'backend', label: 'Backend' },
];

const providerLabels = {
  'google-drive': 'Google Drive',
  onedrive: 'OneDrive',
};

function getProviderConnection(providerConnections, provider) {
  return (
    providerConnections.find((connection) => connection.provider === provider) || {
      provider,
      connectionStatus: 'disconnected',
      accountLabel: '',
    }
  );
}

function renderProviderCard({
  provider,
  settings,
  providerConnections,
  isLoading,
  isSaving,
  onBeginProviderConnection,
  onDisconnectProvider,
}) {
  const connection = getProviderConnection(providerConnections, provider);
  const label = providerLabels[provider];
  const isConnected = connection.connectionStatus === 'connected';
  const isDefault = settings.storageDestination === provider;

  return (
    <div key={provider} className="grid gap-4 rounded-[24px] border bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h4 className="text-xl font-semibold leading-[1.2]">{label}</h4>
          <p className="text-sm text-muted-foreground">
            {connection.accountLabel || `Connect ${label} from Privanote Settings.`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isConnected ? (
            <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">
              Connected
            </span>
          ) : null}
          {isDefault ? (
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              Default destination
            </span>
          ) : null}
        </div>
      </div>

      {connection.connectionStatus === 'pending' ? (
        <div className="rounded-2xl border border-dashed bg-secondary/70 px-4 py-3 text-sm text-muted-foreground">
          Finish the provider flow in your browser. Privanote will refresh this card automatically.
        </div>
      ) : null}

      {connection.connectionStatus === 'error' ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {connection.lastError || `${label} could not be connected.`}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {!isConnected ? (
          <button
            type="button"
            onClick={() => onBeginProviderConnection(provider)}
            disabled={isLoading || isSaving}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            {provider === 'google-drive' ? 'Connect Google Drive' : 'Connect OneDrive'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onDisconnectProvider(provider)}
            disabled={isLoading || isSaving}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-destructive/30 px-4 text-sm font-semibold text-destructive"
          >
            {provider === 'google-drive' ? 'Disconnect Google Drive' : 'Disconnect OneDrive'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function SettingsView({
  settings,
  providerConnections,
  error,
  errorDetail,
  isLoading,
  isSaving,
  onChange,
  onChooseDirectory,
  onClearCredential,
  onSave,
  onBeginProviderConnection,
  onDisconnectProvider,
  captureAppPresets,
  captureApps,
  onToggleCaptureApp,
}) {
  const isLocalDestination = settings.storageDestination === 'local';
  const isBackendMode = settings.transcriptionMode === 'backend';

  return (
    <section className="grid gap-8 rounded-[32px] border bg-background p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Settings
        </p>
        <h2 className="text-xl font-semibold leading-[1.2]">Storage and transcription preferences</h2>
        <p className="text-sm text-muted-foreground">
          These settings persist across relaunch and apply to future saves without changing your existing notes.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <div>{error}</div>
          {errorDetail ? <div className="mt-2 text-xs text-destructive/80">{errorDetail}</div> : null}
        </div>
      ) : null}

      <div className="grid gap-6 rounded-[28px] bg-secondary/70 p-6">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold leading-[1.2]">Cloud sync</h3>
          <p className="text-sm text-muted-foreground">
            Connect Google Drive or OneDrive in Settings to sync future saves while keeping every
            attachment on this device.
          </p>
        </div>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold">Default destination</legend>
          {storageOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
              <input
                type="radio"
                name="storage-destination"
                value={option.value}
                checked={settings.storageDestination === option.value}
                onChange={() => onChange({ storageDestination: option.value })}
                disabled={isLoading || isSaving}
              />
              <span className="text-sm font-semibold">{option.label}</span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-4">
          {renderProviderCard({
            provider: 'google-drive',
            settings,
            providerConnections,
            isLoading,
            isSaving,
            onBeginProviderConnection,
            onDisconnectProvider,
          })}
          {renderProviderCard({
            provider: 'onedrive',
            settings,
            providerConnections,
            isLoading,
            isSaving,
            onBeginProviderConnection,
            onDisconnectProvider,
          })}
        </div>

        <p className="text-sm text-muted-foreground">
          Future saves and older unsynced local media will queue to the selected destination.
          Already-synced items stay where they are.
        </p>
      </div>

      <div className="grid gap-6 rounded-[28px] bg-secondary/70 p-6">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold leading-[1.2]">Storage</h3>
          <p className="text-sm text-muted-foreground">
            Choose where future local media saves should land when Local is the active destination.
          </p>
        </div>

        <div className="grid gap-3 rounded-2xl border bg-background p-4">
          <label className="text-sm font-semibold" htmlFor="local-media-directory">
            Local folder
          </label>
          <input
            id="local-media-directory"
            className="h-11 rounded-xl border bg-background px-3 text-sm"
            readOnly
            value={settings.localMediaDirectory || ''}
            placeholder="Choose a folder for future local saves"
          />
          <button
            type="button"
            onClick={onChooseDirectory}
            disabled={isLoading || isSaving || !isLocalDestination}
            className="inline-flex h-11 items-center justify-center rounded-xl border bg-background px-4 text-sm font-semibold"
          >
            Choose Folder
          </button>
        </div>
      </div>

      <div className="grid gap-6 rounded-[28px] bg-secondary/70 p-6">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold leading-[1.2]">Transcription</h3>
          <p className="text-sm text-muted-foreground">
            Select how Privanote should handle new transcript jobs for saved audio and video.
          </p>
        </div>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold">Mode</legend>
          {transcriptionOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
              <input
                type="radio"
                name="transcription-mode"
                value={option.value}
                checked={settings.transcriptionMode === option.value}
                onChange={() => onChange({ transcriptionMode: option.value })}
                disabled={isLoading || isSaving}
              />
              <span className="text-sm font-semibold">{option.label}</span>
            </label>
          ))}
        </fieldset>

        {!isBackendMode ? (
          <div className="rounded-2xl border border-dashed bg-background px-4 py-4 text-sm text-muted-foreground">
            Local transcription downloads its runtime once and keeps it on this device.
          </div>
        ) : null}
      </div>

      {isBackendMode ? (
        <div className="grid gap-6 rounded-[28px] bg-secondary/70 p-6">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold leading-[1.2]">Provider</h3>
            <p className="text-sm text-muted-foreground">
              Use your OpenAI backend API key for transcript jobs in Backend mode.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border bg-background p-4">
            <label className="text-sm font-semibold" htmlFor="backend-api-key">
              OpenAI API Key
            </label>
            <input
              id="backend-api-key"
              className="h-11 rounded-xl border bg-background px-3 text-sm"
              type="password"
              value={settings.backendApiKey || ''}
              placeholder={settings.backendApiKeyMaskedHint || 'Enter API key'}
              onChange={(event) =>
                onChange({
                  backendApiKey: event.target.value,
                  clearBackendApiKey: false,
                })
              }
              disabled={isLoading || isSaving}
            />
            {settings.backendApiKeyConfigured && !settings.backendApiKey ? (
              <p className="text-sm text-muted-foreground">
                Saved key: {settings.backendApiKeyMaskedHint}
              </p>
            ) : null}
            {settings.backendApiKeyConfigured || settings.backendApiKey ? (
              <button
                type="button"
                onClick={onClearCredential}
                disabled={isLoading || isSaving}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-destructive/30 px-4 text-sm font-semibold text-destructive"
              >
                Clear Credential
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 rounded-[28px] bg-secondary/70 p-6">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold leading-[1.2]">Capture apps</h3>
          <p className="text-sm text-muted-foreground">
            Choose which apps trigger the floating capture button. The button appears only when a selected app is in the foreground.
          </p>
        </div>
        <div className="grid gap-4">
          {(captureAppPresets || []).map((app) => (
            <label key={app.id} className="flex items-center justify-between gap-2 rounded-2xl border bg-background px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{app.label}</span>
                <span className="text-sm text-muted-foreground">{app.description}</span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(captureApps[app.id])}
                onChange={() => onToggleCaptureApp(app.id)}
                disabled={isLoading || isSaving}
                className="h-5 w-5 accent-primary"
              />
            </label>
          ))}
        </div>
        {!Object.values(captureApps || {}).some(Boolean) ? (
          <p className="text-sm text-muted-foreground">
            No apps selected. The capture button will stay hidden until you enable at least one app.
          </p>
        ) : null}
      </div>

      <div className="flex justify-start">
        <button
          type="button"
          onClick={onSave}
          disabled={isLoading || isSaving}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Save Settings
        </button>
      </div>
    </section>
  );
}

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

export default function SettingsView({
  settings,
  error,
  errorDetail,
  isLoading,
  isSaving,
  onChange,
  onChooseDirectory,
  onClearCredential,
  onSave,
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
          <h3 className="text-xl font-semibold leading-[1.2]">Storage</h3>
          <p className="text-sm text-muted-foreground">
            Choose where future media saves should land. Existing attachments stay where they already are.
          </p>
        </div>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold">Destination</legend>
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

        {isLocalDestination ? (
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
              disabled={isLoading || isSaving}
              className="inline-flex h-11 items-center justify-center rounded-xl border bg-background px-4 text-sm font-semibold"
            >
              Choose Folder
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-background px-4 py-4 text-sm text-muted-foreground">
            Cloud destinations are preferences only in Phase 3. Upload and sync arrive in Phase 4.
          </div>
        )}
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

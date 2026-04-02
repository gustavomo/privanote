import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

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
            <Badge>Connected</Badge>
          ) : null}
          {isDefault ? (
            <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">Default destination</Badge>
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
          <Button
            size="lg"
            onClick={() => onBeginProviderConnection(provider)}
            disabled={isLoading || isSaving}
          >
            {provider === 'google-drive' ? 'Connect Google Drive' : 'Connect OneDrive'}
          </Button>
        ) : (
          <Button
            variant="destructive-outline"
            size="lg"
            onClick={() => onDisconnectProvider(provider)}
            disabled={isLoading || isSaving}
          >
            {provider === 'google-drive' ? 'Disconnect Google Drive' : 'Disconnect OneDrive'}
          </Button>
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

        <div className="grid gap-3">
          <Label className="text-sm font-semibold">Default destination</Label>
          <RadioGroup
            value={settings.storageDestination}
            onValueChange={(value) => onChange({ storageDestination: value })}
            disabled={isLoading || isSaving}
          >
            {storageOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
                <RadioGroupItem value={option.value} />
                <span className="text-sm font-semibold">{option.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

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

      <Separator />

      <div className="grid gap-6 rounded-[28px] bg-secondary/70 p-6">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold leading-[1.2]">Storage</h3>
          <p className="text-sm text-muted-foreground">
            Choose where future local media saves should land when Local is the active destination.
          </p>
        </div>

        <div className="grid gap-3 rounded-2xl border bg-background p-4">
          <Label htmlFor="local-media-directory">
            Local folder
          </Label>
          <Input
            id="local-media-directory"
            readOnly
            value={settings.localMediaDirectory || ''}
            placeholder="Choose a folder for future local saves"
          />
          <Button
            variant="outline"
            size="lg"
            onClick={onChooseDirectory}
            disabled={isLoading || isSaving || !isLocalDestination}
          >
            Choose Folder
          </Button>
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 rounded-[28px] bg-secondary/70 p-6">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold leading-[1.2]">Transcription</h3>
          <p className="text-sm text-muted-foreground">
            Select how Privanote should handle new transcript jobs for saved audio and video.
          </p>
        </div>

        <div className="grid gap-3">
          <Label className="text-sm font-semibold">Mode</Label>
          <RadioGroup
            value={settings.transcriptionMode}
            onValueChange={(value) => onChange({ transcriptionMode: value })}
            disabled={isLoading || isSaving}
          >
            {transcriptionOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
                <RadioGroupItem value={option.value} />
                <span className="text-sm font-semibold">{option.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

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
            <Label htmlFor="backend-api-key">
              OpenAI API Key
            </Label>
            <Input
              id="backend-api-key"
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
              <Button
                variant="destructive-outline"
                size="lg"
                onClick={onClearCredential}
                disabled={isLoading || isSaving}
              >
                Clear Credential
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <Separator />

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
              <Checkbox
                checked={Boolean(captureApps[app.id])}
                onCheckedChange={() => onToggleCaptureApp(app.id)}
                disabled={isLoading || isSaving}
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
        <Button
          size="lg"
          onClick={onSave}
          disabled={isLoading || isSaving}
        >
          Save Settings
        </Button>
      </div>
    </section>
  );
}

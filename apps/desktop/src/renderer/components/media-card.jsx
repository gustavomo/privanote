import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Trash2, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';

const mediaTitles = {
  audio: 'Audio preview',
  video: 'Video preview',
  file: 'Saved file',
};

function resolveMediaLabel(kind) {
  if (kind === 'audio') {
    return 'Audio';
  }

  if (kind === 'video') {
    return 'Video';
  }

  return 'File';
}

function resolveSyncBadge(attachment) {
  const status = attachment.sync_status || 'local_only';
  const provider = attachment.sync_provider || '';

  if (status === 'failed') {
    return 'Sync failed';
  }

  if (status === 'synced' && provider === 'google-drive') {
    return 'Synced to Google Drive';
  }

  if (status === 'synced' && provider === 'onedrive') {
    return 'Synced to OneDrive';
  }

  if (status === 'queued' || status === 'syncing') {
    return 'Syncing';
  }

  return 'Local only';
}

export default function MediaCard({
  attachment,
  formatDate,
  getAttachmentContentUrl,
  onOpenFile,
  onRemove,
  onRetrySync,
  pendingAction,
}) {
  const isAnyPending = Boolean(pendingAction);
  const [contentUrl, setContentUrl] = useState('');
  const [contentError, setContentError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!['audio', 'video'].includes(attachment.kind)) {
      setContentUrl('');
      setContentError('');
      return () => {
        cancelled = true;
      };
    }

    setContentError('');

    getAttachmentContentUrl(attachment.id)
      .then((url) => {
        if (!cancelled) {
          setContentUrl(url || '');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setContentError(error.message || 'Unable to load media preview.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attachment.id, attachment.kind, getAttachmentContentUrl]);

  const label = resolveMediaLabel(attachment.kind);
  const syncBadge = resolveSyncBadge(attachment);
  const showSyncFailure = attachment.sync_status === 'failed';
  const showTranscriptPending = Boolean(attachment.transcript_patch_pending);

  return (
    <li>
      <Card className="rounded-[24px]">
        <CardContent className="p-5 grid gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {label}
                </p>
                <h4 className="text-xl font-semibold leading-[1.2]">{mediaTitles[attachment.kind]}</h4>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-muted-foreground">Saved {formatDate(attachment.created_at)}</p>
                  <Badge
                    variant={
                      showSyncFailure
                        ? 'destructive'
                        : syncBadge === 'Local only'
                          ? 'secondary'
                          : 'outline'
                    }
                    className={
                      !showSyncFailure && syncBadge !== 'Local only'
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : undefined
                    }
                  >
                    {syncBadge}
                  </Badge>
                </div>
                {showTranscriptPending ? (
                  <p className="text-sm text-muted-foreground">
                    Media uploaded. Transcript and metadata will sync when ready.
                  </p>
                ) : null}
              </div>
            </div>

            {(attachment.sync_status === 'syncing' || attachment.sync_status === 'queued') && (
              <Progress className="progress-indeterminate h-1" />
            )}

            {attachment.kind === 'audio' ? (
              contentError ? (
                <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{contentError}</AlertDescription>
                </Alert>
              ) : contentUrl ? (
                <audio controls preload="metadata" src={contentUrl} className="w-full" />
              ) : (
                <div className="rounded-2xl border border-dashed bg-secondary/70 px-4 py-6 text-sm text-muted-foreground">
                  Loading audio preview...
                </div>
              )
            ) : null}

            {attachment.kind === 'video' ? (
              contentError ? (
                <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{contentError}</AlertDescription>
                </Alert>
              ) : contentUrl ? (
                <video
                  controls
                  preload="metadata"
                  src={contentUrl}
                  className="max-h-[320px] w-full rounded-2xl bg-secondary"
                />
              ) : (
                <div className="rounded-2xl border border-dashed bg-secondary/70 px-4 py-6 text-sm text-muted-foreground">
                  Loading video preview...
                </div>
              )
            ) : null}

            <p className="text-sm leading-6 text-muted-foreground">{attachment.local_path}</p>

            {showSyncFailure ? (
              <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  <div>
                    Sync failed. Your local file is still available. Retry sync or reconnect this provider in
                    Settings.
                  </div>
                  {attachment.sync_error ? (
                    <div className="mt-2 text-xs text-destructive/80">{attachment.sync_error}</div>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            {showSyncFailure ? (
              <Button
                onClick={onRetrySync}
                loading={pendingAction === 'retry'}
                disabled={isAnyPending}
              >
                <RefreshCw className="size-4" />
                Retry Sync
              </Button>
            ) : null}
            {attachment.kind === 'file' ? (
              <Button
                variant="outline"
                onClick={() => onOpenFile(attachment.local_path)}
                loading={pendingAction === 'open'}
                disabled={isAnyPending}
              >
                <ExternalLink className="size-4" />
                Open File
              </Button>
            ) : null}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive-outline"
                  loading={pendingAction === 'remove'}
                  disabled={isAnyPending}
                >
                  <Trash2 className="size-4" />
                  Remove Media
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove media?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this media file from the note. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isAnyPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={onRemove}
                    disabled={isAnyPending}
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

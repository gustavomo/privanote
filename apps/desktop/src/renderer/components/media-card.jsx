import React, { useEffect, useState } from 'react';

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

export default function MediaCard({
  attachment,
  formatDate,
  getAttachmentContentUrl,
  onOpenFile,
  onRemove,
}) {
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

  return (
    <li className="grid gap-4 rounded-[24px] border bg-background p-5 shadow-sm">
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {label}
            </p>
            <h4 className="text-xl font-semibold leading-[1.2]">{mediaTitles[attachment.kind]}</h4>
            <p className="text-sm text-muted-foreground">Saved {formatDate(attachment.created_at)}</p>
          </div>
        </div>

        {attachment.kind === 'audio' ? (
          contentError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {contentError}
            </div>
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
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {contentError}
            </div>
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
      </div>

      <div className="flex flex-wrap gap-3">
        {attachment.kind === 'file' ? (
          <button
            type="button"
            onClick={() => onOpenFile(attachment.local_path)}
            className="inline-flex h-10 items-center justify-center rounded-xl border bg-background px-4 text-sm font-semibold"
          >
            Open File
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-destructive/30 px-4 text-sm font-semibold text-destructive"
        >
          Remove Media
        </button>
      </div>
    </li>
  );
}

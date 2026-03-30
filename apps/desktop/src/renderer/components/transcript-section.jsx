import React, { useEffect } from 'react';

function isProcessingTranscript(transcript) {
  return transcript && ['queued', 'processing'].includes(transcript.status);
}

export default function TranscriptSection({
  noteId,
  transcript,
  error,
  isLoading,
  onRefresh,
  onRetry,
}) {
  useEffect(() => {
    if (!noteId || !isProcessingTranscript(transcript)) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      onRefresh(noteId);
    }, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [noteId, onRefresh, transcript]);

  const status = transcript?.status || '';

  return (
    <section className="grid gap-4 rounded-[28px] bg-secondary/70 p-6">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold leading-[1.2]">Transcript</h3>
        <p className="text-sm text-muted-foreground">
          Generated transcript text stays separate from your editable note content.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!transcript && !isLoading ? (
        <div className="rounded-2xl border border-dashed bg-background px-4 py-6 text-sm text-muted-foreground">
          Save audio or video to generate a transcript automatically for this note.
        </div>
      ) : null}

      {isProcessingTranscript(transcript) ? (
        <div className="rounded-2xl border bg-background px-4 py-6 text-sm text-muted-foreground">
          <div className="mb-2 text-sm font-semibold uppercase tracking-[0.12em]">{status}</div>
          Generating transcript... Privanote is processing the latest saved media for this note.
        </div>
      ) : null}

      {transcript?.status === 'succeeded' ? (
        <div className="grid gap-4 rounded-2xl border bg-background p-4">
          <div className="rounded-2xl border bg-secondary/50 px-4 py-4 text-sm leading-6 text-foreground">
            {transcript.text}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-11 items-center justify-center rounded-xl border bg-background px-4 text-sm font-semibold"
            >
              Regenerate Transcript
            </button>
          </div>
        </div>
      ) : null}

      {transcript?.status === 'failed' ? (
        <div className="grid gap-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <div>Transcript could not be generated. Check your transcription settings and try again.</div>
          {transcript.last_error ? <div className="text-xs text-destructive/80">{transcript.last_error}</div> : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-destructive/30 px-4 text-sm font-semibold text-destructive"
            >
              Retry Transcript
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

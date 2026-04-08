import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';

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
  isRetrying = false,
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
    <Card className="rounded-[28px] bg-secondary/70 border-0 ring-0 shadow-none">
      <CardHeader className="px-6 pt-6 pb-0">
        <CardTitle className="text-xl font-semibold leading-[1.2]">Transcript</CardTitle>
        <CardDescription>
          Generated transcript text stays separate from your editable note content.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-4 grid gap-4">
        {error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!transcript && !isLoading ? (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="p-5 text-center">
              <p className="text-sm text-muted-foreground">
                Save audio or video to generate a transcript automatically for this note.
              </p>
            </CardContent>
          </Card>
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
              <Button
                variant="outline"
                size="lg"
                onClick={onRetry}
                loading={isRetrying}
                disabled={isRetrying}
              >
                <RefreshCw className="size-4" />
                Regenerate Transcript
              </Button>
            </div>
          </div>
        ) : null}

        {transcript?.status === 'failed' ? (
          <div className="grid gap-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            <div>Transcript could not be generated. Check your transcription settings and try again.</div>
            {transcript.last_error ? <div className="text-xs text-destructive/80">{transcript.last_error}</div> : null}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="destructive-outline"
                size="lg"
                onClick={onRetry}
                loading={isRetrying}
                disabled={isRetrying}
              >
                <RefreshCw className="size-4" />
                Retry Transcript
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

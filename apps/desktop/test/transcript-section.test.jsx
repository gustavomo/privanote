import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TranscriptSection from '../src/renderer/components/transcript-section.jsx';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('transcript section', () => {
  it('polls every 2000ms while queued and stops polling when the transcript settles', () => {
    const onRefresh = vi.fn();
    const onRetry = vi.fn();
    const { rerender } = render(
      <TranscriptSection
        noteId={7}
        transcript={{ status: 'queued', text: '', last_error: '' }}
        error=""
        isLoading={false}
        onRefresh={onRefresh}
        onRetry={onRetry}
      />
    );

    expect(
      screen.getByText('Generating transcript... Privanote is processing the latest saved media for this note.')
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onRefresh).toHaveBeenCalledWith(7);

    rerender(
      <TranscriptSection
        noteId={7}
        transcript={{ status: 'succeeded', text: 'Transcript body', last_error: '' }}
        error=""
        isLoading={false}
        onRefresh={onRefresh}
        onRetry={onRetry}
      />
    );

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders failed and succeeded transcript actions', () => {
    const onRefresh = vi.fn();
    const onRetry = vi.fn();
    const { rerender } = render(
      <TranscriptSection
        noteId={9}
        transcript={{ status: 'failed', text: '', last_error: 'backend failure' }}
        error=""
        isLoading={false}
        onRefresh={onRefresh}
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry Transcript' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <TranscriptSection
        noteId={9}
        transcript={{ status: 'succeeded', text: 'Recovered transcript', last_error: '' }}
        error=""
        isLoading={false}
        onRefresh={onRefresh}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('Recovered transcript')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Transcript' }));
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});

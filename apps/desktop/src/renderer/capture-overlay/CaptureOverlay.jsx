import React, { useCallback, useEffect, useState } from 'react';
import './capture-overlay.css';

// Inline SVG icons (no external icon library in overlay -- per UI-SPEC)
function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="capture-spinner" viewBox="0 0 24 24">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export default function CaptureOverlay() {
  const [state, setState] = useState('idle'); // idle | recording | finalizing

  useEffect(() => {
    if (!window.captureApi) return;

    // Sync initial state
    window.captureApi.getSessionState().then((s) => {
      if (s) setState(s);
    });

    // Listen for state changes from main process
    const cleanup = window.captureApi.onStateChange((newState) => {
      setState(newState);
    });

    return cleanup;
  }, []);

  const handleClick = useCallback(async () => {
    if (!window.captureApi) return;
    if (state === 'finalizing') return; // Ignore clicks while finalizing

    if (state === 'idle') {
      await window.captureApi.startSession();
    } else if (state === 'recording') {
      await window.captureApi.stopSession();
    }
  }, [state]);

  const buttonClass = `capture-button capture-button--${state}`;

  const icon =
    state === 'idle' ? <CameraIcon /> :
    state === 'recording' ? <StopIcon /> :
    <SpinnerIcon />;

  const tooltip = state === 'idle' ? 'Start screen capture' : state === 'recording' ? 'Stop screen capture' : 'Creating note...';

  return (
    <div className="capture-overlay-root">
      <div className="capture-button-container">
        {state === 'recording' && <div className="capture-pulse-ring" />}
        <button
          className={buttonClass}
          onClick={handleClick}
          title={tooltip}
          aria-label={tooltip}
        >
          {icon}
        </button>
      </div>
    </div>
  );
}

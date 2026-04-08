import React, { useEffect, useRef, useState } from 'react';

const greetings = [
  '¡Hola! Soy Nota.',
  '¿Listos para grabar?',
  'Tus notas están seguras.',
  'Local first, siempre.',
  '¿Necesitas ayuda?',
];

export default function FloatingAvatar() {
  const [hovered, setHovered] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const [message, setMessage] = useState(null);
  const [blink, setBlink] = useState(false);
  const messageTimer = useRef(null);
  const bounceTimer = useRef(null);

  // Periodic random blinking (2-5s intervals)
  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;

    const scheduleBlink = () => {
      const next = 2000 + Math.random() * 3000;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          setBlink(false);
          scheduleBlink();
        }, 160);
      }, next);
    };

    scheduleBlink();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
      if (bounceTimer.current) clearTimeout(bounceTimer.current);
    };
  }, []);

  const handleClick = () => {
    setBouncing(true);
    if (bounceTimer.current) clearTimeout(bounceTimer.current);
    bounceTimer.current = setTimeout(() => setBouncing(false), 600);

    const next = greetings[Math.floor(Math.random() * greetings.length)];
    setMessage(next);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 select-none"
      aria-live="polite"
    >
      {message ? (
        <div className="floating-avatar-bubble max-w-[200px] rounded-2xl border border-border bg-popover px-3 py-2 text-xs font-medium text-popover-foreground shadow-lg">
          {message}
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Avatar de Privanote"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
        className={`floating-avatar group relative h-16 w-16 cursor-pointer rounded-full border border-border bg-card shadow-[0_18px_42px_-18px_rgba(15,23,42,0.45)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          bouncing ? 'floating-avatar-bounce' : 'floating-avatar-float'
        }`}
      >
        {/* Pulsing aura */}
        <span className="floating-avatar-aura pointer-events-none absolute inset-0 rounded-full" />

        <svg
          viewBox="0 0 80 80"
          className="relative h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="avatar-body" cx="50%" cy="38%" r="65%">
              <stop offset="0%" stopColor="oklch(0.82 0.12 245)" />
              <stop offset="60%" stopColor="oklch(0.62 0.17 258)" />
              <stop offset="100%" stopColor="oklch(0.48 0.18 270)" />
            </radialGradient>
            <radialGradient id="avatar-cheek" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="oklch(0.82 0.14 25 / 0.85)" />
              <stop offset="100%" stopColor="oklch(0.82 0.14 25 / 0)" />
            </radialGradient>
          </defs>

          {/* Body */}
          <circle cx="40" cy="42" r="26" fill="url(#avatar-body)" />

          {/* Top highlight */}
          <ellipse cx="30" cy="26" rx="9" ry="5" fill="white" opacity="0.35" />

          {/* Cheeks */}
          <circle cx="26" cy="46" r="4" fill="url(#avatar-cheek)" />
          <circle cx="54" cy="46" r="4" fill="url(#avatar-cheek)" />

          {/* Eyes */}
          <g>
            <ellipse
              cx="32"
              cy="40"
              rx="2.6"
              ry={blink ? 0.3 : 3.2}
              fill="#0b1020"
              style={{ transition: 'ry 120ms ease' }}
            />
            <ellipse
              cx="48"
              cy="40"
              rx="2.6"
              ry={blink ? 0.3 : 3.2}
              fill="#0b1020"
              style={{ transition: 'ry 120ms ease' }}
            />
            {!blink ? (
              <>
                <circle cx="33" cy="39" r="0.9" fill="white" />
                <circle cx="49" cy="39" r="0.9" fill="white" />
              </>
            ) : null}
          </g>

          {/* Mouth — opens on hover */}
          {hovered ? (
            <path
              d="M32 50 Q40 59 48 50 Q40 56 32 50 Z"
              fill="#0b1020"
              opacity="0.85"
            />
          ) : (
            <path
              d="M33 51 Q40 56 47 51"
              stroke="#0b1020"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* Waving hand on hover */}
          {hovered ? (
            <g
              className="floating-avatar-hand"
              style={{ transformOrigin: '64px 38px' }}
            >
              <circle cx="64" cy="38" r="5" fill="url(#avatar-body)" />
              <circle cx="64" cy="38" r="3" fill="oklch(0.88 0.10 248)" />
            </g>
          ) : null}
        </svg>
      </button>
    </div>
  );
}

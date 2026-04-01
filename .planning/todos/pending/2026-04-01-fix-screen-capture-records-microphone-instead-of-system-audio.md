---
created: 2026-04-01T01:34:17.823Z
title: Fix screen capture records microphone instead of system audio
area: general
files: []
---

## Problem

When using screen capture, the app is only recording audio from the microphone instead of capturing the system/PC audio. Users expect the screen recording to include the audio output from the computer (e.g., app sounds, media playback), not just the mic input.

## Solution

Investigate the audio capture configuration in the screen recording implementation. The media stream constraints likely need to be updated to request system audio (e.g., using `chromeMediaSource: 'desktop'` with `audio: true` in Electron's `desktopCapturer`, or equivalent approach). May need to use loopback audio capture depending on the platform.

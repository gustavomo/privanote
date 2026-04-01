---
created: 2026-04-01T09:48:56.809Z
title: Detect active media and show recording button
area: ui
files: []
---

## Problem

When the user has an active microphone or video session (e.g., in a call or using the camera), there's no way for PrivaNote to detect this and offer a quick recording option. The user should be able to capture audio/video notes seamlessly when they're already using media devices, without having to manually navigate to a recording feature.

## Solution

- Detect active microphone/camera usage via system APIs (e.g., `navigator.mediaDevices` or platform-specific APIs on Electron/Tauri)
- When active media is detected, show a floating/contextual button that allows the user to start recording
- The recording should integrate with the existing note capture flow
- Consider platform differences: desktop (Tauri) may have different APIs than web
- Handle permissions gracefully — only show the button when access is available

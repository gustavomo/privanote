---
created: 2026-04-01T23:04:00.000Z
title: Record screen not camera to capture call participants
area: general
files: []
---

## Problem

When video is detected (e.g., during a video call), the recording captures the camera/video feed. The actual need is to capture the screen content — specifically the other participants in the call, shared screens, and presentation content. This applies to both the main panel and the floating button recording paths.

## Solution

When a video call or video media is detected:
1. Always record the screen (via desktopCapturer / screen capture) instead of the webcam/camera feed
2. This should apply regardless of whether recording is triggered from the main panel or the floating button
3. Screen capture ensures all call participants, shared content, and chat are included in the recording
4. The transcription pipeline should still process the audio from the call for speech-to-text

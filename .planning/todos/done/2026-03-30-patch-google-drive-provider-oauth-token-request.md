---
created: 2026-03-30T21:31:20.654Z
title: Patch Google Drive provider OAuth token request
area: api
files:
  - apps/backend/src/services/providers/google-drive-provider.js
  - apps/backend/.env
---

## Problem

The Google Drive provider is not including `PRIVANOTE_GOOGLE_CLIENT_SECRET` in the POST request to `https://oauth2.googleapis.com/token`. This is a code-level fix, not a configuration fix — the env var exists but the provider doesn't read and forward it.

## Solution

1. Read `PRIVANOTE_GOOGLE_CLIENT_SECRET` from env in the Google Drive provider.
2. Include `client_secret` in the POST body sent to `https://oauth2.googleapis.com/token`.

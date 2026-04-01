---
created: 2026-04-01T23:06:00.000Z
title: AI agent for note search and insights using ADK
area: general
files: []
---

## Problem

Users accumulate many notes over time (recordings, transcriptions, screen captures, clipboard captures) but have no intelligent way to search across them or extract insights. Finding specific information requires manually browsing through notes. There is no system-level feature that can answer questions like "what did we discuss about X?" or "summarize my meetings from last week."

## Solution

Two-layer system: semantic search + RAG-powered insights.

### Layer 1 — Search (no LLM needed at query time)
- Index all notes (descriptions, transcriptions, capture text, metadata) as embeddings in sqlite-vec (extends existing better-sqlite3)
- Keyword search + vector similarity search
- Date-range and metadata filtering
- Returns ranked note references the user can browse

### Layer 2 — RAG Insights (LLM at query time)
- Retrieve relevant note chunks via Layer 1
- Feed retrieved context to LLM (OpenAI provider already configured)
- Generate answers to questions like "what did we discuss about X?" or "summarize my meetings from last week"
- Conversational agent interface (chat-style) within the app
- Cross-note synthesis: summaries, comparisons, timelines

### Architecture
- Embeddings: OpenAI embeddings API (or local model for privacy)
- Vector storage: sqlite-vec extension on existing SQLite DB
- Agent framework: ADK or similar for orchestrating retrieval + generation
- Index updates: re-embed on note creation/edit/capture completion

# Implementation Plan: Scalability & Resilience

**Feature Branch**: `002-002-scalability`
**Created**: 2026-03-01
**Status**: Active

---

## Constitution Check

- **Scope**: Hardening the existing Next.js ATS scanner to handle concurrent users safely
- **No new user-facing features** — all changes are infrastructure / API layer
- **Backward compatible** — all existing endpoints, request/response shapes, and UI remain unchanged
- **Zero new paid services** — uses only in-process primitives (Maps, queues) + SQLite (file-based, free)

---

## Tech Stack (unchanged from 001)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), Node.js runtime |
| UI | MUI v5 — no changes |
| AI | Groq API · LLaMA 3.3 70B |
| New: Storage | SQLite via `better-sqlite3` (replaces `data/scans.json`) |
| New: Rate limiting | In-process `Map`-based sliding window (no Redis needed) |
| New: Retry | Exponential backoff in `lib/scan.ts` (no new deps) |
| New: Request queue | In-process semaphore (no BullMQ/Redis needed for this scale) |

---

## Problem Statement

The current implementation has four critical failure modes under concurrent load:

1. **Race condition** — `scans.json` read-modify-write is not atomic; concurrent writes corrupt the log
2. **No rate limiting** — a single user can exhaust the Groq API quota instantly
3. **No Groq retry** — a single `429 Too Many Requests` propagates directly to the browser as a 500
4. **Unbounded concurrency** — 50 simultaneous scans = 50 simultaneous Groq calls; free tier allows ~30/min

---

## Project Structure (changes only)

```
lib/
  scan.ts            ← add fetchWithRetry(), concurrency semaphore
  db.ts              ← NEW: SQLite helper (replaces data/scans.json)
  rateLimit.ts       ← NEW: in-process per-IP sliding window limiter
app/
  api/
    scan/
      route.ts       ← add rate limit check, use db.ts for log writes
specs/
  002-002-scalability/
    plan.md          ← this file
    spec.md
    data-model.md
    tasks.md
```

---

## Libraries

```bash
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

`better-sqlite3` is synchronous and safe for Next.js Node.js runtime — no connection pool needed for SQLite.

---

## Architecture Decisions

### Rate Limiting: In-process Map (not Redis)
- Redis adds ops cost and complexity for a single-instance app
- In-process `Map` resets on server restart — acceptable for prototype/small scale
- Upgrade path: swap `lib/rateLimit.ts` implementation to `@upstash/ratelimit` when moving to serverless/edge

### Concurrency: Semaphore (not BullMQ)
- A simple Promise-based semaphore caps simultaneous Groq calls to N=5
- Excess requests wait (up to 30s timeout) rather than failing immediately
- Upgrade path: replace semaphore with BullMQ + Redis worker when scale requires it

### Storage: SQLite (not Postgres)
- Removes the file-corruption race condition with zero infra
- Single-file DB, no server, works on any host
- Upgrade path: swap `better-sqlite3` driver for `@prisma/client` + Postgres

### Retry: Exponential backoff (not circuit breaker)
- 3 retries with 1s / 2s / 4s delays covers transient Groq 429s
- No circuit breaker needed at this scale

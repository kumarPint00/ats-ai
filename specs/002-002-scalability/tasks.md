# Tasks: Scalability & Resilience

**Branch**: `002-002-scalability`
**Input**: Design documents from `/specs/002-002-scalability/`
**Prerequisites**: plan.md ✅ · spec.md ✅
**Tests**: Not requested — no test tasks generated.
**Date**: 2026-03-01

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Parallelisable — different files, no dependencies on in-progress tasks
- **[US#]**: Maps to user story from spec.md
- No label = Setup or Foundational or Polish phase task

---

## Phase 1: Setup

**Purpose**: Install new dependency and update gitignore.

- [X] T001 Install `better-sqlite3` and its types: `npm install better-sqlite3 && npm install --save-dev @types/better-sqlite3`
- [X] T002 [P] Add `data/scans.db` to `.gitignore`

**Checkpoint**: `npm install` succeeds · `data/scans.db` appears in `.gitignore`

---

## Phase 2: Foundational

**Purpose**: Core infrastructure modules that all user stories depend on — MUST be complete before any story work begins.

**⚠️ CRITICAL**: All three new modules (`lib/rateLimit.ts`, `lib/db.ts`, updated `lib/scan.ts`) must be complete before `app/api/scan/route.ts` is touched.

- [X] T003 Create `lib/rateLimit.ts` — export `checkRateLimit(ip: string): { limited: boolean; retryAfter: number }` using an in-process `Map<string, { count: number; resetAt: number }>` with a 60-second sliding window and a limit of 5 requests per IP. Fall back to key `"unknown"` when `ip` is falsy.
- [X] T004 [P] Create `lib/db.ts` — export `initDb()` (creates `data/scans.db` and the `scans` table if absent: `id INTEGER PRIMARY KEY AUTOINCREMENT, score REAL, summary TEXT, created_at TEXT`) and `appendScan(score: number, summary: string)` and `getAllScans(): { score: number; summary: string; createdAt: string }[]` using `better-sqlite3`. Call `initDb()` at module load time so the DB is ready on first import.
- [X] T005 [P] Update `lib/scan.ts` — replace the bare `fetch(...)` call to Groq with a `fetchWithRetry(url, options, retries = 3)` helper that retries on HTTP 429 or 503 with delays of 1 s, 2 s, 4 s and throws `new Error("AI service is busy. Please try again shortly.")` after exhausting all retries. Non-retriable status codes (400, 401, etc.) must throw immediately without retrying.
- [X] T006 Create `lib/semaphore.ts` — export `class Semaphore` with constructor `(maxConcurrent: number, timeoutMs: number)`, method `acquire(): Promise<void>` (queues if at capacity; rejects with `new Error("Server is busy. Please try again shortly.")` after `timeoutMs`), and method `release(): void`. Instantiate and export a singleton `scanSemaphore = new Semaphore(5, 30_000)`.

**Checkpoint**: All four files compile with zero TypeScript errors (`npx tsc --noEmit`)

---

## Phase 3: User Story 1 — Per-IP Rate Limiting (Priority: P1) 🎯 MVP

**Goal**: Each IP is limited to 5 scans per 60 seconds. Excess requests get 429 with `Retry-After`.

**Independent Test**: Send 6 rapid POST `/api/scan` requests from the same IP → first 5 return results, 6th returns 429 with `Retry-After` header and `{ "error": "Rate limit exceeded. Try again in N seconds." }`.

- [X] T007 [US1] Wire `checkRateLimit` into `app/api/scan/route.ts` POST handler — at the top of the handler, before any other logic, call `checkRateLimit(request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown")`. If `limited` is true, return `NextResponse.json({ error: \`Rate limit exceeded. Try again in \${retryAfter} seconds.\` }, { status: 429, headers: { "Retry-After": String(retryAfter) } })`.

**Checkpoint**: US1 independently testable — curl the endpoint 6 times rapidly and confirm the 6th returns 429 with `Retry-After` header.

---

## Phase 4: User Story 2 — Groq Retry with Exponential Backoff (Priority: P1)

**Goal**: Transient Groq 429/503 errors are retried up to 3 times with 1 s / 2 s / 4 s delays before surfacing to the client.

**Independent Test**: Temporarily replace the Groq URL with a local mock that returns 429 twice then 200 → `POST /api/scan` returns a successful result. Replace with a mock that always returns 429 → `POST /api/scan` returns 503 `{ "error": "AI service is busy. Please try again shortly." }`.

- [X] T008 [US2] Verify `lib/scan.ts` `fetchWithRetry` (from T005) correctly wraps the Groq call — confirm `scanWithGroq()` no longer calls `fetch()` directly but routes through `fetchWithRetry()` and that the error message on exhaustion is `"AI service is busy. Please try again shortly."`
- [X] T009 [P] [US2] Update error handling in `app/api/scan/route.ts` catch block — if `err.message` includes `"AI service is busy"`, return status 503 instead of 500 so the client can distinguish a retriable failure from an unexpected server error.

**Checkpoint**: US2 independently testable — with Groq API key temporarily invalidated, confirm the endpoint returns 503 with the correct message after ~7 s (1+2+4 s backoff).

---

## Phase 5: User Story 3 — Concurrency Semaphore (Priority: P2)

**Goal**: At most 5 `scanWithGroq()` calls execute simultaneously; extras queue up to 30 s before timing out.

**Independent Test**: Fire 10 simultaneous scans (e.g., via `Promise.all([...10 fetches])`); all 10 resolve (some after queuing); server logs show at most 5 active at once.

- [X] T010 [US3] Wrap `scanWithGroq()` call in `app/api/scan/route.ts` with `scanSemaphore` — call `await scanSemaphore.acquire()` before `scanWithGroq()` and `scanSemaphore.release()` in a `finally` block. Import `scanSemaphore` from `lib/semaphore.ts`.
- [X] T011 [US3] Update error handling in `app/api/scan/route.ts` catch block — if `err.message` includes `"Server is busy"`, return status 503 so the client gets a meaningful response.

**Checkpoint**: US3 independently testable — 10 concurrent requests all eventually resolve; at most 5 are active simultaneously.

---

## Phase 6: User Story 4 — SQLite Scan Log (Priority: P2)

**Goal**: Replace the race-prone `data/scans.json` read-modify-write with atomic SQLite writes.

**Independent Test**: 20 concurrent scans → `GET /api/scan` returns exactly 20 records with no duplicates or missing entries.

- [X] T012 [US4] Update the log-write block in `app/api/scan/route.ts` POST handler — replace all `fs` / JSON file operations with `appendScan(result.score, result.summary)` imported from `lib/db.ts`. Remove all `fs` imports used only for the JSON log (keep `fs` import if still used elsewhere).
- [X] T013 [P] [US4] Update `GET /api/scan` handler in `app/api/scan/route.ts` — replace `fs.readFileSync` + `JSON.parse` with `getAllScans()` imported from `lib/db.ts`. Return the result directly. Handle the case where the DB does not yet exist by returning `[]` (the `initDb()` call in `lib/db.ts` ensures the table exists, so this is only a safeguard).
- [X] T014 [P] [US4] Remove `pdf-parse`-unrelated `fs` imports from `app/api/scan/route.ts` if no longer needed after replacing JSON file operations. Verify the file still compiles.

**Checkpoint**: US4 independently testable — delete `data/scans.db`, run 5 scans concurrently, confirm `GET /api/scan` returns exactly 5 records.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Error message consistency, type safety, build validation.

- [X] T015 [P] Add `data/*.db` pattern to `.gitignore` as a catch-all (complements T002's explicit `data/scans.db` entry)
- [X] T016 [P] Update `.env.example` — add comment block explaining rate limit and concurrency settings for future tuning: `# RATE_LIMIT_MAX=5`, `# RATE_LIMIT_WINDOW_MS=60000`, `# MAX_CONCURRENT_SCANS=5`
- [X] T017 Run `npx tsc --noEmit` and fix any TypeScript errors introduced by the new files
- [X] T018 Run `npm run build` and confirm zero errors (SC-005)

**Checkpoint**: Build passes · All four user stories are independently verifiable · No `fs` JSON log code remains

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001 installs `better-sqlite3`)
- **Phases 3–6 (User Stories)**: All depend on Phase 2 being fully complete
  - US1 (T007) depends only on T003
  - US2 (T008, T009) depends only on T005
  - US3 (T010, T011) depends only on T006
  - US4 (T012, T013, T014) depends only on T004
  - **US1 and US2 can be implemented before US3/US4 (higher priority)**
- **Phase 7 (Polish)**: Depends on all story phases complete

### User Story Dependencies

| Story | Depends On | Independently Testable? |
|-------|-----------|------------------------|
| US1 — Rate Limiting (P1) | T003 (rateLimit.ts) | ✅ Yes — curl 6× rapid fire |
| US2 — Groq Retry (P1) | T005 (fetchWithRetry) | ✅ Yes — invalidate key, check 503 |
| US3 — Semaphore (P2) | T006 (semaphore.ts) | ✅ Yes — 10 concurrent requests |
| US4 — SQLite Log (P2) | T004 (db.ts) | ✅ Yes — 20 concurrent, count records |

### Within Each User Story

- New lib module → wire into route.ts → verify error handling → checkpoint

---

## Parallel Execution Examples

### Phase 2 — run together (different files)

```
T003  lib/rateLimit.ts     ← sliding window rate limiter
T004  lib/db.ts            ← SQLite helper
T005  lib/scan.ts          ← fetchWithRetry wrapper
T006  lib/semaphore.ts     ← concurrency semaphore
```

### Phase 3 + 4 — run together (same file, different blocks)

```
T007  [US1] rate limit check at top of POST handler
T008  [US2] verify fetchWithRetry wired in scanWithGroq
T009  [US2] 503 for AI-busy errors in catch block
```

### Phase 5 + 6 — run together (same file, different blocks)

```
T010  [US3] semaphore.acquire/release around scanWithGroq
T012  [US4] replace JSON log with appendScan()
T013  [US4] replace JSON read with getAllScans() in GET handler
```

---

## Implementation Strategy

**MVP = Phase 1 + Phase 2 + Phase 3 + Phase 4** (US1 + US2 only)

These two P1 stories require zero new dependencies beyond what's already installed (`better-sqlite3` is only needed for US4), can be validated immediately, and eliminate the two most common failure modes (quota exhaustion + 429 propagation).

US3 and US4 can follow as a second increment — they require the new semaphore and SQLite modules but don't change any external API behaviour.

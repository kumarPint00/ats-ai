# Feature Specification: Scalability & Resilience

**Feature Branch**: `002-002-scalability`
**Created**: 2026-03-01
**Status**: Active

## Overview

Harden the ATS Resume Scanner API to handle concurrent users safely. No new user-facing features — all changes are infrastructure and API layer only.

---

## User Stories

### User Story 1 — Per-IP Rate Limiting (Priority: P1) 🎯 MVP

As a system operator, I want each IP address to be limited to 5 scans per minute, so that a single user cannot exhaust the Groq API quota and degrade service for others.

**Why this priority**: Without rate limiting a single bad actor can exhaust the entire Groq free-tier quota in seconds, making the app unusable for everyone.

**Independent Test**: Send 6 rapid POST `/api/scan` requests from the same IP → first 5 return results, 6th returns 429 with `Retry-After` header and a human-readable error message.

**Acceptance Scenarios**:

1. **Given** an IP has made 5 requests in the last 60 s, **When** a 6th request arrives, **Then** respond 429 with `{ "error": "Rate limit exceeded. Try again in N seconds." }` and `Retry-After: N`
2. **Given** an IP has made 4 requests, **When** a 5th request arrives, **Then** it succeeds normally with no 429
3. **Given** 60 s have passed since the first request, **When** the same IP sends another request, **Then** the counter resets and the request succeeds

### Edge Cases
- IP is `undefined` (local dev / reverse proxy strips header) → fall back to `"unknown"`, apply limit as a single bucket
- Server restarts reset the in-memory counter — acceptable for this scale

---

### User Story 2 — Groq Retry with Exponential Backoff (Priority: P1)

As a user, I want transient Groq API errors to be retried automatically, so that temporary rate-limit spikes don't surface as errors in my browser.

**Why this priority**: Groq 429s are frequent on the free tier. Without retry, every burst causes user-visible failures.

**Independent Test**: Mock Groq to return 429 twice then 200 → the client receives the successful result with no error. Mock 3× 429 → client receives 503 with `"AI service is busy"`.

**Acceptance Scenarios**:

1. **Given** Groq returns 429, **When** the system retries with backoff, **Then** a subsequent 200 is returned to the client transparently
2. **Given** Groq returns 429 three times in a row, **Then** the API returns 503 `{ "error": "AI service is busy. Please try again shortly." }`
3. **Given** Groq returns 401, **Then** the error is NOT retried and fails immediately with the original message

---

### User Story 3 — Concurrency Semaphore (Priority: P2)

As a system operator, I want simultaneous Groq calls capped at 5 in-flight, so that bursts of users don't all hit Groq simultaneously and trigger rate limits.

**Why this priority**: Caps the blast radius of concurrent load; works synergistically with retry to smooth out bursts.

**Independent Test**: Fire 10 simultaneous scans; observe server logs show at most 5 running at once; all 10 eventually complete.

**Acceptance Scenarios**:

1. **Given** 5 scans are in-flight, **When** a 6th request arrives, **Then** it waits in a FIFO queue
2. **Given** a request has been queued for 30 s without starting, **Then** it returns 503 `{ "error": "Server is busy. Please try again shortly." }`
3. **Given** a slot frees up, **When** a queued request is next, **Then** it starts immediately

---

### User Story 4 — SQLite Scan Log (Priority: P2)

As a system operator, I want scan history stored in SQLite instead of a JSON file, so that concurrent writes never corrupt the log.

**Why this priority**: The current JSON log will silently lose data under any concurrent load. SQLite's write serialisation makes this atomic by default.

**Independent Test**: Run 20 concurrent scans → `GET /api/scan` returns exactly 20 records with no duplicates.

**Acceptance Scenarios**:

1. **Given** 10 concurrent scans complete, **When** `GET /api/scan` is called, **Then** all 10 appear in the response
2. **Given** no DB file exists, **When** the first scan runs, **Then** the DB and schema are created automatically
3. **Given** the DB exists, **When** `GET /api/scan` is called, **Then** records are returned newest-first

---

## Functional Requirements

- **FR-001**: Rate limiter MUST use a sliding window of 60 seconds, limit 5 requests per IP
- **FR-002**: Rate limit response MUST include `Retry-After` header (seconds until reset)
- **FR-003**: Groq fetch MUST retry on 429 and 503 only, with delays 1 s / 2 s / 4 s
- **FR-004**: At most 5 `scanWithGroq()` calls MUST be in-flight simultaneously
- **FR-005**: Queued requests exceeding 30 s wait MUST return 503
- **FR-006**: Scan log writes MUST be atomic (SQLite replaces `data/scans.json`)
- **FR-007**: All existing API request/response shapes MUST be preserved
- **FR-008**: `data/scans.db` MUST be added to `.gitignore`

---

## Success Criteria

- **SC-001**: 6 rapid requests from same IP → 5 succeed, 1 returns 429 with `Retry-After`
- **SC-002**: Groq 429 on attempt 1 → client eventually receives result (retry succeeded)
- **SC-003**: 10 simultaneous scans → at most 5 run at once, all complete
- **SC-004**: 20 concurrent scans → `GET /api/scan` returns exactly 20 records
- **SC-005**: `npm run build` exits 0 with zero TypeScript errors

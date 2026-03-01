# Implementation Plan: Advanced Resume Analysis with Deep AI Insights

**Branch**: `001-advanced-analysis` | **Date**: 2026-03-01 | **Spec**: [specs/001-advanced-analysis/spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-advanced-analysis/spec.md`

## Summary

Extend the ATS Resume Scanner from a simple keyword-match tool into a full AI coaching assistant. The Groq LLaMA 3.3 70B chat-completions endpoint is prompted for a single structured JSON response containing 10 analysis fields: ATS score, matched/missing keywords, summary, grammar suggestions, strong points, weak points, 10 tailored interview questions, course recommendations, and a preparation guide. Results are displayed in a 7-tab glassmorphism UI with animated dark theme.

## Technical Context

**Language/Version**: TypeScript 5.x · Next.js 16.1.6 · Node.js 20.x (App Router, `runtime = "nodejs"`)  
**Primary Dependencies**: `next@16`, `@mui/material@5`, `@emotion/react`, `@emotion/styled`, `pdf-parse`, Groq REST API  
**Storage**: Local JSON file — `data/scans.json` (prototype; no database)  
**Testing**: None configured yet — NEEDS CLARIFICATION (Jest + React Testing Library recommended)  
**Target Platform**: macOS (dev) · Node.js server (prod)  
**Project Type**: Full-stack web application (Next.js)  
**Performance Goals**: < 15 s total round-trip from submit to full result render; < 100 ms UI tab switch  
**Constraints**: Groq has no embeddings endpoint — chat completions only · `GROQ_API_KEY` env var required · `pdf-parse` requires Node.js runtime (no edge runtime)  
**Scale/Scope**: Single-user prototype · No authentication · No rate-limiting beyond Groq's own limits

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> ⚠️ The project constitution (`/.specify/memory/constitution.md`) is a placeholder template — no project-specific principles have been ratified. Gates below are evaluated against general Next.js full-stack best practices.

| Gate | Status | Notes |
|------|--------|-------|
| Single responsibility (one API call per scan) | ✅ PASS | `POST /api/scan` does exactly one thing |
| Secrets not in source | ✅ PASS | `GROQ_API_KEY` in `.env`, excluded from git |
| No hardcoded magic values | ✅ PASS | Model name + API URL are constants in `lib/scan.ts` |
| Error boundaries present | ✅ PASS | Try/catch in route + UI shows error message |
| Data persisted safely | ✅ PASS | JSON appended atomically via `fs.writeFileSync` |
| Tests required before shipping | ⚠️ N/A | Constitution not ratified; recommend adding Jest before production |

**Post-design re-check**: No new violations introduced in Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/001-advanced-analysis/
├── plan.md              ← this file
├── spec.md              ← feature spec
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── api.md           ← Phase 1 output
└── tasks.md             ← Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
app/
├── globals.css          ← keyframe animations, glassmorphism, gradient body
├── layout.tsx           ← MUI dark ThemeProvider (client component)
├── page.tsx             ← main UI: input form + 7-tab results panel
└── api/
    └── scan/
        └── route.ts     ← POST (scan) + GET (history) handlers

lib/
└── scan.ts              ← ScanResult interface + scanWithGroq() function

data/
└── scans.json           ← persistent scan history log (runtime-generated)

types/
├── pdf-parse.d.ts
└── formidable.d.ts

.env                     ← GROQ_API_KEY (not committed)
.env.example             ← template for GROQ_API_KEY
```

**Structure Decision**: Single Next.js project (Option 1). Frontend and API co-located per Next.js App Router conventions. No separate backend service needed at prototype scale.

## Complexity Tracking

> No constitution violations requiring justification.

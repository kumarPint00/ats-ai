# Tasks: Resume‑to‑JD Scanner

This document translates the implementation plan for the resume‑to‑JD matching application into a sequenced, story‑oriented checklist.  The project is a Next.js + MUI frontend with serverless API routes calling OpenAI embeddings and performing simple keyword analysis.  

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the repository, add dependencies and basic file scaffolding.

- [x] T001 [P] Create Next.js project structure (`app/`, `next.config.ts`, etc.)
- [x] T002 [P] Add Material‑UI and emotion packages to `package.json`
- [x] T003 [P] Add OpenAI, formidable, pdf‑parse packages to `package.json`
- [x] T004 [P] Create utility module `lib/scan.ts` with placeholders for later functions
- [x] T005 [P] Add `types/openai.d.ts` to supply minimal OpenAI typings
- [x] T006 [P] Scaffold API route directory `app/api/scan/route.ts`
- [x] T007 [P] Update `tsconfig.json` to include custom typings and ensure strict mode

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build core logic and infrastructure that all stories rely upon.

- [x] T008 [P] Implement keyword extraction function in `lib/scan.ts`
- [x] T009 [P] Implement embedding helper and cosine similarity in `lib/scan.ts`
- [x] T010 [P] Implement basic `/api/scan` POST handling of JSON text in `app/api/scan/route.ts`
- [x] T011 [P] Extend POST handler to parse `multipart/form-data` uploads (formidable) and PDF text via `pdf-parse`
- [x] T012 [P] Add simple file‑based logging of each scan to `data/scans.json` in POST handler
- [x] T013 [P] Implement GET handler in `app/api/scan/route.ts` to return logged scans
- [x] T014 [P] Update `README.md` with feature description, setup instructions, and API details

*Checkpoint*: Foundational code is ready; user story work may begin.

---

## Phase 3: User Story 1 – Core Scanning (Priority: P1) 🎯 MVP

**Goal**: Provide a UI form where users can paste resume and job description text, submit it, and view a similarity score plus matched/missing keywords.

**Independent Test**: Manually POST two text blobs to `/api/scan` and verify the response contains numerical score and keyword lists; UI should display those values after pressing “Scan”.

- [x] T015 [US1] Build form skeleton in `app/page.tsx` with two text areas and a Scan button
- [x] T016 [US1] Add React state for `resume` and `jd` inputs in `app/page.tsx`
- [x] T017 [US1] Implement fetch call to `/api/scan` and store result in state
- [x] T018 [US1] Display `matches` and `missing` keywords in the page when `result` is available
- [x] T019 [US1] Add loading indicator (`CircularProgress`) to the Scan button while request is in flight

*Checkpoint*: Core text‑to‑text scanning should function standalone.

---

## Phase 4: User Story 2 – File Uploads & Parsing (Priority: P2)

**Goal**: Allow users to upload PDF or text files for the resume and JD; server parses them automatically.

**Independent Test**: Upload sample PDF files via the form; ensure the server extracts text and returns a valid score.

- [x] T020 [US2] Add file input buttons (`<input type="file" />`) for resume and JD in `app/page.tsx`
- [x] T021 [US2] Update submission logic in `app/page.tsx` to send a `FormData` object when files are present
- [x] T022 [US2] Ensure server-side parsing of uploaded files works (covered by POST handler enhancements)
- [x] T023 [US2] Show chosen file names under the upload buttons in the UI

*Checkpoint*: File‑upload workflow is functional and independent of text fields.

---

## Phase 5: User Story 3 – Scan History (Priority: P3)

**Goal**: Provide a mechanism to view previously performed scans using the logged JSON data.

**Independent Test**: After running several scans, click “Load scan history” and confirm a list of past scores/timestamps appears.

- [x] T024 [US3] Add `history` state variable and `loadHistory` function to `app/page.tsx`
- [x] T025 [US3] Implement `loadHistory` to fetch `/api/scan` (GET) and store results
- [x] T026 [US3] Render a simple list of previous scan scores and timestamps in the UI

*Checkpoint*: History viewing should operate without relying on other stories.

---

## Phase 6: Polish & Cross‑Cutting Concerns

**Purpose**: Touch‑ups, documentation, and housekeeping affecting all stories.

- [x] T027 [P] Tidy up unused template code and comments in `app/page.tsx`
- [x] T028 [P] Create `.env.example` with `OPENAI_API_KEY` placeholder
- [x] T029 [P] Add brief comments to utility functions in `lib/scan.ts`
- [x] T030 [P] Ensure `data/scans.json` directory is in `.gitignore` or documented
- [x] T031 [P] Add basic styling adjustments (spacing, typography) across pages

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** – independent; start immediately.
- **Foundational (Phase 2)** – requires Setup completion; blocks all user stories.
- **User Story Phases (3–5)** – depend on Foundational; once Phase 2 is complete, stories may proceed in parallel or in priority order (P1→P2→P3).
- **Polish (Phase 6)** – follows completion of all desired stories.

### User Story Dependencies

- **US1 (P1)** – starts after Phase 2; no dependencies on other stories.
- **US2 (P2)** – can start after Phase 2; extensions of the core scanning logic but independently testable.
- **US3 (P3)** – can start after Phase 2; relies only on logging introduced in Phase 2.

### Parallel Opportunities

- All Phase 1 tasks labeled [P] are parallelizable.
- Phase 2 tasks are likewise marked [P] and can be executed concurrently.
- Within each user story, tasks that touch different files (models, services, UI) are flagged [P].
- Separate user stories (US1/US2/US3) can be worked on simultaneously by different developers.
- Phase 6 tasks are cross‑cutting and marked [P] where appropriate.

---

## Quick Summary

- **Total tasks**: 31
- **Tasks per story**: US1 = 5, US2 = 4, US3 = 3 (remaining tasks are Setup/Foundation/Polish)
- **Parallelizable tasks**: ~20 (marked [P])
- **Independent test criteria**: Each story notes a concrete way to verify success without other stories.
- **Suggested MVP scope**: Deliver US1 first (core text scanning) before adding file uploads or history.

With this checklist, the project can be implemented incrementally and tested story‑by‑story, matching the earlier plan for a resume‑to‑JD scanning application.
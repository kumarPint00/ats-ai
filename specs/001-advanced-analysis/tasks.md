# Tasks: Advanced Resume Analysis with Deep AI Insights

**Branch**: `001-advanced-analysis`  
**Input**: Design documents from `/specs/001-advanced-analysis/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/api.md ✅ · quickstart.md ✅  
**Tests**: Not requested — no test tasks generated.  
**Date**: 2026-03-01

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Parallelisable — different files, no dependencies on in-progress tasks
- **[US#]**: Maps to user story from spec.md
- No label = Setup or Foundational or Polish phase task

---

## Phase 1: Setup

**Purpose**: Verify project scaffold, environment, and shared infrastructure are production-ready.

- [X] T001 Verify `GROQ_API_KEY` and `LLM_PROVIDER` are documented in `.env.example`
- [X] T002 [P] Add `data/` to `.gitignore` to prevent committing scan history and PII
- [X] T003 [P] Verify `export const runtime = "nodejs"` is present in `app/api/scan/route.ts`
- [X] T004 Verify `data/` directory is auto-created before first write in `app/api/scan/route.ts` using `fs.mkdirSync(dir, { recursive: true })`

**Checkpoint**: Environment config complete — dev server starts with `npm run dev`, build passes with `npm run build`

---

## Phase 2: Foundational

**Purpose**: Core data model and Groq integration — MUST be complete before any user story tab can work end-to-end.

**⚠️ CRITICAL**: Every user story depends on `ScanResult` being correctly typed and `scanWithGroq()` returning all 10 fields.

- [X] T005 Verify `RecommendedCourse` interface is exported from `lib/scan.ts` as `export interface RecommendedCourse { title: string; reason: string }`
- [X] T006 Verify `ScanResult` interface in `lib/scan.ts` includes all 10 required fields: `score`, `matches`, `missing`, `summary`, `grammarSuggestions`, `strongPoints`, `weakPoints`, `interviewQuestions`, `recommendedCourses`, `preparationGuide`
- [X] T007 Verify the Groq system prompt in `lib/scan.ts` explicitly names all 10 JSON fields with their types so the model reliably populates them
- [X] T008 Add score normalisation in `app/page.tsx` — coerce `result.score` to float 0–1: `const score = result.score > 1 ? result.score / 100 : result.score` and use `score` everywhere instead of `result.score` directly
- [X] T009 Add input validation in `app/api/scan/route.ts` POST handler — return `{ status: 400, body: { error: "Both resumeText and jdText are required." } }` when both resolved text values are empty strings
- [X] T010 [P] Verify `app/api/scan/route.ts` logs only `{ score, summary, createdAt }` to `data/scans.json` (not full resume/JD text — privacy per data-model.md)

**Checkpoint**: Call `POST /api/scan` with sample text → confirm JSON response contains all 10 fields populated · `GET /api/scan` returns scan log entries

---

## Phase 3: User Story 1 — ATS Score + Keyword Match (Priority: P1) 🎯 MVP

**Goal**: User submits resume + JD text (or PDF) and sees score ring, 2–3 sentence summary, and matched/missing keyword chips.

**Independent Test**: Paste any resume + JD text → click "⚡ Analyse Resume" → within 15 s: circular score ring appears with correct colour coding, summary paragraph is visible, Keywords tab shows at least one green chip and one red chip.

- [X] T011 [US1] Apply score coercion (from T008) to the circular `CircularProgress` `value` prop in `app/page.tsx` — `value={score * 100}` (not `result.score * 100`)
- [X] T012 [US1] Apply score coercion to `scoreColor()` and `scoreLabel()` helper calls in `app/page.tsx`
- [X] T013 [P] [US1] Verify matched keyword chips render with `background: rgba(74,222,128,0.1)` green styling in `app/page.tsx` Keywords tab (Tab 0)
- [X] T014 [P] [US1] Verify missing keyword chips render with `background: rgba(248,113,113,0.1)` red styling in `app/page.tsx` Keywords tab (Tab 0)
- [X] T015 [US1] Add empty state to Keywords tab in `app/page.tsx` — when `result.matches` is empty show `<Typography sx={{ color: "rgba(255,255,255,0.3)" }}>No keyword matches found.</Typography>` and same for `result.missing`
- [X] T016 [P] [US1] Verify PDF upload path in `app/api/scan/route.ts` — `pdf-parse(Buffer.from(await file.arrayBuffer()))` extracts text before passing to `scanWithGroq()`
- [X] T017 [US1] Add graceful handling for image-only PDF in `app/api/scan/route.ts` — if extracted text is empty after pdf-parse, return `{ status: 400, body: { error: "PDF appears to be image-only — no text could be extracted. Please paste text instead." } }`

**Checkpoint**: US1 fully functional — score, summary, and keyword chips work for both text paste and PDF upload paths

---

## Phase 4: User Story 2 — Grammar Correction Suggestions (Priority: P2)

**Goal**: ✍️ Grammar tab displays specific phrasing issues from the resume, quoting original text and suggesting a fix.

**Independent Test**: Submit a resume containing "Responsible for managing" → analysis completes → Grammar tab shows at least one suggestion quoting the original phrase with a recommended rewrite.

- [X] T018 [US2] Verify Grammar tab (Tab 3) in `app/page.tsx` renders `result.grammarSuggestions` list with ✎ prefix icon per item
- [X] T019 [US2] Add empty state to Grammar tab in `app/page.tsx` — when `result.grammarSuggestions` is an empty array show `<Typography sx={{ color: "rgba(255,255,255,0.3)", py: 3, textAlign: "center" }}>✅ No grammar issues found — your resume reads cleanly.</Typography>`
- [X] T020 [P] [US2] Ensure Groq system prompt in `lib/scan.ts` instructs the model to quote the original text in each grammar suggestion (e.g., `"Original: '...' → Suggested: '...'"`)

**Checkpoint**: Grammar tab shows suggestions for a resume with passive voice; shows clean empty state for a well-written resume

---

## Phase 5: User Story 3 — Strong Points & Weak Points (Priority: P2)

**Goal**: 💪 Strengths tab and ⚠️ Weaknesses tab each list specific, JD-relative observations about the resume.

**Independent Test**: Submit any resume + JD → Strengths tab shows ≥1 item with a ✦ icon; Weaknesses tab shows ≥1 item with a ◆ icon; both are specific to the provided content, not generic.

- [X] T021 [US3] Verify Strengths tab (Tab 1) in `app/page.tsx` renders `result.strongPoints` with ❆ prefix and `color: "#4ade80"`
- [X] T022 [US3] Verify Weaknesses tab (Tab 2) in `app/page.tsx` renders `result.weakPoints` with ◆ prefix and `color: "#fb923c"`
- [X] T023 [P] [US3] Add empty state to Strengths tab in `app/page.tsx` — when `result.strongPoints` is empty show `<Typography sx={{ color: "rgba(255,255,255,0.3)", py: 3, textAlign: "center" }}>No specific strengths identified relative to this JD.</Typography>`
- [X] T024 [P] [US3] Add empty state to Weaknesses tab in `app/page.tsx` — when `result.weakPoints` is empty show `<Typography sx={{ color: "rgba(255,255,255,0.3)", py: 3, textAlign: "center" }}>No significant weaknesses identified — strong overall match!</Typography>`

**Checkpoint**: Both Strengths and Weaknesses tabs render correctly and handle the empty-array edge case

---

## Phase 6: User Story 4 — Tailored Interview Questions (Priority: P3)

**Goal**: 🎤 Interview Prep tab displays exactly 10 numbered, domain-specific interview questions based on the resume and JD.

**Independent Test**: Submit a software engineering resume + a senior engineer JD → Interview Prep tab shows 10 questions numbered with gradient circle badges; questions reference specific skills from the resume (e.g., TypeScript, React).

- [X] T025 [US4] Verify Interview Prep tab (Tab 4) in `app/page.tsx` renders `result.interviewQuestions` with gradient numbered circle badges (30×30 px, `linear-gradient(135deg, #818cf8, #38bdf8)`)
- [X] T026 [US4] Add empty state to Interview Prep tab in `app/page.tsx` — when `result.interviewQuestions` is empty show `<Typography sx={{ color: "rgba(255,255,255,0.3)", py: 3, textAlign: "center" }}>No interview questions generated.</Typography>`
- [X] T027 [P] [US4] Verify Groq system prompt in `lib/scan.ts` explicitly requests `"interviewQuestions": [<exactly 10 questions tailored to this specific resume and JD>]`

**Checkpoint**: Interview Prep tab shows 10 questions for a well-populated resume + JD pair; empty state shows for malformed responses

---

## Phase 7: User Story 5 — Course Recommendations (Priority: P3)

**Goal**: 📚 Courses tab renders hover-animated cards — each with a course title and the specific gap it addresses.

**Independent Test**: Submit a resume missing Docker experience against a JD requiring Docker → Courses tab shows ≥1 card with title "Docker…" and a reason mentioning the container gap.

- [X] T028 [US5] Verify Courses tab (Tab 5) in `app/page.tsx` renders `result.recommendedCourses` as a 3-column grid of glass cards with hover lift (`translateY(-3px)`)
- [X] T029 [US5] Add empty state to Courses tab in `app/page.tsx` — when `result.recommendedCourses` is empty show `<Typography sx={{ color: "rgba(255,255,255,0.3)", py: 3, textAlign: "center" }}>🎉 No specific courses needed — your skills align well with this role.</Typography>`
- [X] T030 [P] [US5] Verify `RecommendedCourse` fields are rendered correctly: `c.title` in `color: "#c4b5fd"` and `c.reason` in `color: "rgba(255,255,255,0.48)"`

**Checkpoint**: Courses tab shows skill-gap–linked course cards; empty state displays for strong-match candidates

---

## Phase 8: User Story 6 — Step-by-Step Preparation Guide (Priority: P4)

**Goal**: 🗺️ Prep Guide tab shows an ordered numbered action list with alternating gradient badges.

**Independent Test**: Submit any resume + JD → Prep Guide tab shows ≥5 steps with numbered square badges alternating indigo and cyan gradients; each step is a concrete action sentence.

- [X] T031 [US6] Verify Prep Guide tab (Tab 6) in `app/page.tsx` renders `result.preparationGuide` with alternating gradient badge colours: even-index `linear-gradient(135deg, #818cf8, #c4b5fd)`, odd-index `linear-gradient(135deg, #38bdf8, #818cf8)`
- [X] T032 [US6] Add empty state to Prep Guide tab in `app/page.tsx` — when `result.preparationGuide` is empty show `<Typography sx={{ color: "rgba(255,255,255,0.3)", py: 3, textAlign: "center" }}>No preparation steps generated.</Typography>`

**Checkpoint**: Prep Guide tab shows ≥5 ordered action steps for a typical resume + JD pair

---

## Phase 9: User Story 7 — Scan History (Priority: P5)

**Goal**: Clicking "🕘 Load scan history" fetches the `data/scans.json` log and renders score cards with timestamps.

**Independent Test**: Complete 2 scans → click "Load scan history" → 2 glass cards appear, each showing a colour-coded score percentage and a locale-formatted timestamp.

- [X] T033 [US7] Verify `GET /api/scan` in `app/api/scan/route.ts` reads `data/scans.json` and returns `[]` (not an error) when file does not exist yet
- [X] T034 [US7] Verify history score cards in `app/page.tsx` use `scoreColor(item.score)` for the percentage colour — consistent with the main score ring colour logic
- [X] T035 [P] [US7] Verify `data/scans.json` is listed in `.gitignore` (from T002) so personal resume data is not committed

**Checkpoint**: History loads correctly after ≥1 scan; empty array returned before first scan; file does not appear in `git status`

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: UX hardening, accessibility, error boundary, and final build validation across all user stories.

- [X] T036 [P] Add `aria-label` attributes to the `Tabs` component and each `Tab` in `app/page.tsx` for screen reader accessibility
- [X] T037 [P] Add loading skeleton shimmer to results area in `app/page.tsx` — show `.shimmer` class `Box` while `loading === true` so the layout does not jump on response arrival
- [X] T038 Ensure error state in `app/page.tsx` resets `activeTab` to `0` when a new scan begins (already done in `handleSubmit` — verify `setActiveTab(0)` is called before `setResult(null)`)
- [X] T039 [P] Verify `.env.example` contains both `GROQ_API_KEY=your_key_here` and `LLM_PROVIDER=groq` with comments explaining each
- [X] T040 [P] Update `README.md` with quick-start instructions: install → copy `.env.example` → add Groq key → `npm run dev`
- [X] T041 Run `npm run build` and confirm zero TypeScript errors — fix any type issues surfaced (SC-005)
- [X] T042 Manual end-to-end smoke test per `specs/001-advanced-analysis/quickstart.md` — walk through all 7 tabs and verify SC-001 through SC-006

**Checkpoint**: Build passes · All 7 tabs render without console errors · Scan history persists across server restart

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks all user story work
- **Phases 3–9 (User Stories)**: All depend on Phase 2 completion
  - Can proceed in parallel once Phase 2 is done (T005–T010 all complete)
  - Or sequentially in priority order: US1 → US2/US3 → US4/US5 → US6 → US7
- **Phase 10 (Polish)**: Depends on all desired user story phases being complete

### User Story Dependencies

| Story | Depends On | Independently Testable? |
|-------|-----------|------------------------|
| US1 (P1) | Phase 2 only | ✅ Yes — score ring + chips |
| US2 (P2) | Phase 2 only | ✅ Yes — Grammar tab alone |
| US3 (P2) | Phase 2 only | ✅ Yes — Strengths + Weaknesses tabs |
| US4 (P3) | Phase 2 only | ✅ Yes — Interview Prep tab alone |
| US5 (P3) | Phase 2 only | ✅ Yes — Courses tab alone |
| US6 (P4) | Phase 2 only | ✅ Yes — Prep Guide tab alone |
| US7 (P5) | Phase 1 T002/T004 | ✅ Yes — History button alone |

### Within Each User Story

- Verify existing implementation → add missing empty states → harden edge cases
- Each story can be verified independently by navigating to its tab after a scan

---

## Parallel Execution Examples

### Phase 2 (Foundational) — run together

```
T005  Verify RecommendedCourse interface export     lib/scan.ts
T006  Verify ScanResult has all 10 fields          lib/scan.ts
T010  Verify scans.json only logs score+summary    app/api/scan/route.ts
```

### Phase 3 (US1) — run together after T008 is done

```
T013  Verify matched chip green styling            app/page.tsx
T014  Verify missing chip red styling              app/page.tsx
T016  Verify PDF upload path                       app/api/scan/route.ts
```

### Phases 5–8 empty states — all in `app/page.tsx`, run together

```
T023  Empty state: Strengths tab
T024  Empty state: Weaknesses tab
T026  Empty state: Interview Prep tab
T029  Empty state: Courses tab
T032  Empty state: Prep Guide tab
```

### Phase 10 (Polish) — run together

```
T036  Add aria-labels to Tabs
T037  Add loading shimmer skeleton
T039  Verify .env.example
T040  Update README.md
```

---

## Implementation Strategy

### MVP: User Story 1 Only (Phase 1 + 2 + 3)

1. Complete Phase 1 (Setup verification) — T001–T004
2. Complete Phase 2 (Foundational) — T005–T010
3. Complete Phase 3 (US1 — Score + Keywords) — T011–T017
4. **STOP and VALIDATE**: Submit a real resume + JD → verify score ring, summary, and chips appear
5. Proceed to Phase 4+ if MVP validated

### Incremental Delivery Order

| Milestone | Phases | Value Delivered |
|-----------|--------|----------------|
| MVP | 1 + 2 + 3 | Score ring, summary, keyword chips |
| v1.1 | + 4 + 5 | Grammar corrections + Strengths/Weaknesses |
| v1.2 | + 6 + 7 | Interview prep + Course recommendations |
| v1.3 | + 8 + 9 | Prep guide + History |
| v1.4 | + 10 | Polish, accessibility, final build |

---

## Task Count Summary

| Phase | Tasks | Notes |
|-------|-------|-------|
| Phase 1: Setup | T001–T004 | 4 tasks |
| Phase 2: Foundational | T005–T010 | 6 tasks |
| Phase 3: US1 — Score + Keywords | T011–T017 | 7 tasks |
| Phase 4: US2 — Grammar | T018–T020 | 3 tasks |
| Phase 5: US3 — Strong/Weak | T021–T024 | 4 tasks |
| Phase 6: US4 — Interview Prep | T025–T027 | 3 tasks |
| Phase 7: US5 — Courses | T028–T030 | 3 tasks |
| Phase 8: US6 — Prep Guide | T031–T032 | 2 tasks |
| Phase 9: US7 — History | T033–T035 | 3 tasks |
| Phase 10: Polish | T036–T042 | 7 tasks |
| **Total** | **T001–T042** | **42 tasks** |

**Parallel opportunities identified**: 22 of 42 tasks marked `[P]`  
**MVP scope**: T001–T017 (17 tasks — Phases 1–3)

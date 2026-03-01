# Feature Specification: Advanced Resume Analysis with Deep AI Insights

**Feature Branch**: `001-advanced-analysis`  
**Created**: 2026-03-01  
**Status**: Draft  
**Input**: User description: "grammar correction suggestion, lacks, strong points, weak points, expected interview questions, expected courses for improvement, preparation guide"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — ATS Score + Keyword Match (Priority: P1)

A job-seeker pastes their resume text (or uploads a PDF) and a job description, then clicks "Analyse Resume". They receive an ATS compatibility score (0–100%), a 2–3 sentence summary, and two chip lists — matched keywords and missing keywords — so they know at a glance how their resume performs against the posting.

**Why this priority**: The score is the core value proposition and the minimum viable result. Everything else builds on it.

**Independent Test**: Paste any resume text + any JD → click Analyse → verify score percentage, summary text, and at least one chip appear in the Keywords tab within 15 s.

**Acceptance Scenarios**:

1. **Given** resume text and JD text are both non-empty, **When** the user submits the form, **Then** a score between 0% and 100% is displayed inside a circular progress ring colour-coded green (≥75%), orange (≥50%), or red (<50%).
2. **Given** a PDF resume is uploaded, **When** the user submits, **Then** the server extracts text from the PDF and returns the same structured result as for plain text.
3. **Given** the Groq API is unreachable, **When** the user submits, **Then** a readable error message is shown and the UI does not crash.

---

### User Story 2 — Grammar Correction Suggestions (Priority: P2)

The candidate receives a list of specific grammar, spelling, and phrasing issues found in their resume — each entry quotes the original text and proposes a concrete fix — so they can polish the document before applying.

**Why this priority**: Poor grammar is a top-3 reason for resume rejection; this directly improves quality.

**Independent Test**: Paste a resume with at least one known grammar error → submit → navigate to the ✍️ Grammar tab → verify that at least one suggestion appears quoting the original text.

**Acceptance Scenarios**:

1. **Given** the resume contains a grammatical issue, **When** analysis completes, **Then** the Grammar tab shows a suggestion with the original phrasing and a recommended correction.
2. **Given** the resume is grammatically clean, **When** analysis completes, **Then** the Grammar tab shows an empty state gracefully, not an error.

---

### User Story 3 — Strong Points & Weak Points (Priority: P2)

The candidate sees a list of concrete strengths (specific to their resume vs. this JD) and a separate list of constructive weaknesses, helping them understand what to emphasise in a cover letter and what to address before the interview.

**Why this priority**: Actionable self-awareness is the second-highest value after the score itself.

**Independent Test**: Submit any resume + JD pair → navigate to 💪 Strengths tab → verify at least one strength appears; navigate to ⚠️ Weaknesses tab → verify at least one weakness appears.

**Acceptance Scenarios**:

1. **Given** analysis completes, **When** user views the Strengths tab, **Then** each item is specific to the provided resume and JD (not generic advice).
2. **Given** analysis completes, **When** user views the Weaknesses tab, **Then** each item is constructive and references a concrete gap relative to the JD.

---

### User Story 4 — Tailored Interview Questions (Priority: P3)

The candidate receives 10 likely interview questions a hiring manager would ask based on the intersection of their specific resume and the JD, so they can prepare targeted answers.

**Why this priority**: Pre-interview preparation is high-value but secondary to understanding fit.

**Independent Test**: Submit resume + JD → navigate to 🎤 Interview Prep tab → verify 10 numbered questions are shown.

**Acceptance Scenarios**:

1. **Given** analysis completes, **When** user views the Interview Prep tab, **Then** 10 questions are listed, each with a numbered gradient circle badge.
2. **Given** the resume and JD are domain-specific (e.g., ML engineering), **When** analysis completes, **Then** the questions reference domain-specific skills from the resume/JD, not only generic questions.

---

### User Story 5 — Course Recommendations (Priority: P3)

The candidate receives a curated list of courses or certifications — each with title and a reason tied to a specific gap — to bridge the missing skills between their resume and the JD.

**Why this priority**: Actionable learning paths add long-term value beyond the immediate application.

**Independent Test**: Submit resume + JD with a clear skills gap → navigate to 📚 Courses tab → verify at least 2 course cards appear, each with a title and a reason.

**Acceptance Scenarios**:

1. **Given** analysis identifies missing skills, **When** user views the Courses tab, **Then** each card shows a course title and explains which specific gap it addresses.
2. **Given** analysis identifies no missing skills, **When** user views the Courses tab, **Then** an appropriate empty state is shown without error.

---

### User Story 6 — Step-by-Step Preparation Guide (Priority: P4)

The candidate receives an ordered checklist of concrete actions to take before submitting or interviewing (e.g., "Add quantified metrics to your experience section"), displayed as a numbered timeline.

**Why this priority**: Synthesises all analysis into an actionable plan — the capstone of the coaching experience.

**Independent Test**: Submit resume + JD → navigate to 🗺️ Prep Guide tab → verify an ordered list of at least 5 steps appears with numbered gradient badges.

**Acceptance Scenarios**:

1. **Given** analysis completes, **When** user views the Prep Guide tab, **Then** steps are ordered by priority and each is a concrete action, not vague advice.
2. **Given** both resume and JD are provided, **When** user views the Prep Guide tab, **Then** at least one step references something specific from the resume or JD content.

---

### User Story 7 — Scan History (Priority: P5)

The user can review past scans (score + timestamp) from a persistent JSON log by clicking "Load scan history", giving them a record of improvement over time.

**Why this priority**: Progress tracking is useful but not critical for MVP.

**Independent Test**: Submit two scans → click "Load scan history" → verify both entries appear with score and timestamp.

**Acceptance Scenarios**:

1. **Given** at least one scan has been completed, **When** user clicks "Load scan history", **Then** a card list appears with score and locale-formatted timestamp for each entry.
2. **Given** no scans have been completed, **When** user clicks "Load scan history", **Then** an empty list is returned without error.

---

### Edge Cases

- What happens when Groq API returns malformed or incomplete JSON (missing fields like `grammarSuggestions`)?
- How does the system handle a PDF that is image-only (no extractable text layer)?
- What if only one of resume or JD is provided (other is empty string)?
- What if `GROQ_API_KEY` is missing or revoked at runtime?
- What if the uploaded file exceeds the Next.js default body size limit?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST send resume text and JD text to Groq LLaMA 3.3 70B via `POST /openai/v1/chat/completions` and receive a structured JSON response.
- **FR-002**: System MUST return all 10 fields: `score`, `matches`, `missing`, `summary`, `grammarSuggestions`, `strongPoints`, `weakPoints`, `interviewQuestions`, `recommendedCourses`, `preparationGuide`.
- **FR-003**: System MUST accept both `multipart/form-data` (file upload) and `application/json` request bodies on `POST /api/scan`.
- **FR-004**: System MUST extract plain text from uploaded PDF files using `pdf-parse` before forwarding to Groq.
- **FR-005**: System MUST persist each scan result to `data/scans.json` with a `createdAt` ISO timestamp.
- **FR-006**: System MUST expose `GET /api/scan` returning the full scan history array.
- **FR-007**: System MUST display results in a tabbed UI with 7 tabs: Keywords, Strengths, Weaknesses, Grammar, Interview Prep, Courses, Prep Guide.
- **FR-008**: System MUST colour-code the score ring: green ≥75%, orange ≥50%, red <50%.
- **FR-009**: System MUST apply a glassmorphism dark theme with an animated gradient background.
- **FR-010**: System MUST handle Groq API errors gracefully, displaying a human-readable error message without crashing.

### Key Entities

- **ScanResult**: AI-generated analysis (score, matches, missing, summary, grammarSuggestions, strongPoints, weakPoints, interviewQuestions, recommendedCourses, preparationGuide).
- **ScanLog**: Persisted entry in `data/scans.json` — ScanResult fields + `createdAt` ISO string.
- **RecommendedCourse**: Nested entity `{ title: string; reason: string }` within ScanResult.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User receives a full analysis result (all 10 fields populated) within 15 seconds of clicking "Analyse Resume" on a broadband connection.
- **SC-002**: All 7 result tabs render without error for any valid Groq response.
- **SC-003**: PDF upload path correctly extracts text and produces an equivalent result to plain-text input for the same content.
- **SC-004**: Zero unhandled JavaScript exceptions in the browser console during a normal scan workflow.
- **SC-005**: `npm run build` passes with zero TypeScript errors.
- **SC-006**: Scan history persists across server restarts (JSON file not cleared on restart).


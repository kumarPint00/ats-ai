# Feature Specification: Enriched Document Support & Interview Q&A

**Feature Branch**: `003-enriched-output`  
**Created**: 2026-03-02  
**Status**: Draft

## Overview

The scanner already returns an ATS score, summary, keywords and basic interview
questions. This feature expands the user experience in three ways:

1. Accept any common document format (Word, ODT, PPTX, XLSX, TXT, etc.) and
   display a preview of the uploaded file before analysis.
2. Generate a richer set of interview materials: for each *strongly required skill*
   mentioned in the job description produce **15 targeted questions**, along with
   concise, interview‑ready answers and a short professional self‑introduction.
3. Surface the preview and the expanded Q&A in the UI so candidates can prepare
   more effectively.

> Bonus: keep the accepted file‑type list DRY by consolidating it in a single
> browser‑safe module so the UI and the server agree.

---

## User Stories & Testing

### User Story 1 — Multi‑format Upload & Preview (Priority: P1)

As a job‑seeker, I want to upload resumes or job descriptions in any of the
commonly used formats (PDF, DOCX, DOC, ODT, PPTX, XLSX, TXT, MD, CSV, RTF) and
see a quick preview of the document content before submitting it, so I can be
sure I chose the right file and that the extractor will handle it correctly.

**Independent Test:** Select a DOCX resume and a PDF JD, observe a small
rendered preview of each in the form (first page for PDFs, plain text for
others); submit the pair and verify the analysis result matches what would
appear if the same text were pasted manually.

**Acceptance Scenarios:**

1. **Given** a user has picked a file, **When** the file input changes, **Then** a
   preview pane appears showing the text or first‑page PDF image.
2. **Given** the user tries to choose an unsupported type (e.g. `.exe`), **Then**
   the file input rejects it and the button label/tooltip explains the allowed
   formats.
3. **Given** the server receives a supported file type, **When** it parses the
   buffer, **Then** it returns the extracted text to the Groq prompt just as it
   would for a PDF or pasted text.

### User Story 2 — Skill‑centric Interview Questions (Priority: P1)

As a candidate, I want fifteen tailored interview questions for each of the
"strongly required" skills in the JD (not just a flat list of ten generic
questions), so I can drill deeply on the technical areas that matter most.

**Independent Test:** Submit a JD mentioning React, TypeScript and Node.js as
strong requirements → `/api/scan` should return at least 45 questions labelled
by skill (15 per skill).

**Acceptance Scenarios:**

1. **Given** the JD emphasises one skill (e.g. React), **When** the analysis runs,
   **Then** the response includes exactly 15 questions prefixed or grouped with
   that skill name.
2. **Given** the JD has three strong skills, **When** analysis completes, **Then**
   questions are grouped and the UI displays them under separate headers.
3. **Given** no strongly required skills can be detected, **Then** fall back to 10
   generic questions (legacy behaviour).

### User Story 3 — Brief Professional Introduction (Priority: P2)

As an interviewee, I want a ready‑made two to three sentence self‑introduction
I could use at the start of a real interview, so I can hit the ground running.

**Independent Test:** The JSON response contains a field `selfIntro` with a
short paragraph summarising the candidate’s background and strengths.

### User Story 4 — Interview‑ready Answers (Priority: P2)

For each question generated, I want a concise, high‑quality answer (two or three
sentences) so I can rehearse both sides of the conversation.

**Independent Test:** The response provides an `answers` object mapping each
question text to its answer; the answers read like something a candidate would
actually say.

---

## Functional Requirements

- **FR‑A1:** The extractor must support the extensions listed in
  `lib/fileTypes.ts` and reject others at the client input level.
- **FR‑A2:** The client must render a preview of the selected file without
  uploading it (text for most formats, `<object>` or PDF.js for PDFs).
- **FR‑A3:** The server API must accept the same list of extensions and parse
  them using `lib/extractText.ts` (already implemented).
- **FR‑A4:** `ScanResult` interface must be extended with:
  - `selfIntro: string`  
  - `interviewQuestions: { skill: string; question: string }[]`  
  - `answers: Record<string,string>` (question → answer)
- **FR‑A5:** Groq prompt (or follow‑up call) must enforce 15 questions per
  strong skill and generate corresponding answers and a self‑introduction.
- **FR‑A6:** UI must display the preview and, in the Interview tab, group
  questions by skill with collapsible answers visible or toggled.
- **FR‑A7:** When no skills are recognised, the system falls back to existing
  behaviour with a warning message.
- **FR‑A8:** Existing functionality (score, keywords, summary, etc.) remains
  unaffected and regressions are covered by tests.

---

## Success Criteria

- Uploading any supported file shows a preview and the server successfully
  extracts text for analysis.
- A JD with three strong skills yields at least 45 labelled questions plus
  answers, and the UI groups them correctly.
- `selfIntro` appears in the received JSON and is rendered prominently (e.g. at
  top of Interview tab).
- The build passes (`npm run build`) and `npm test` (if tests added) succeed.
- No client‑side bundling errors occur from server‑only libraries.

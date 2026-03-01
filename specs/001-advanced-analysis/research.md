# Research: Advanced Resume Analysis

**Branch**: `001-advanced-analysis` | **Date**: 2026-03-01

Resolves all NEEDS CLARIFICATION items from Technical Context and documents decisions for key unknowns.

---

## R-001 — Groq API Capabilities & Limits

**Question**: What structured-output capabilities does Groq offer, and what are the relevant limits?

**Decision**: Use `response_format: { type: "json_object" }` with explicit JSON schema in the system prompt. Model: `llama-3.3-70b-versatile`.

**Findings**:
- Groq exposes only `POST /openai/v1/chat/completions` (OpenAI-compatible). There is **no embeddings endpoint**.
- `response_format: { type: "json_object" }` is supported and forces the model to emit valid JSON.
- Context window: 128k tokens for `llama-3.3-70b-versatile` — more than enough for any resume + JD pair.
- Rate limits (free tier): 30 req/min, 6000 tokens/min. A typical scan prompt is ~1500–2000 tokens in + ~600 tokens out → well within limits.
- The model reliably populates all requested fields when the system prompt explicitly names each field and its type.

**Alternatives Considered**:
- OpenAI `text-embedding-ada-002` → requires OpenAI key; user specified Groq. Rejected.
- Groq streaming → adds UI complexity without benefit for a one-shot JSON response. Rejected.

**Risk**: If Groq changes its `json_object` enforcement, the JSON.parse call will throw. Mitigation: wrap parse in try/catch and return a user-friendly error.

---

## R-002 — Groq Response Field Reliability

**Question**: Will Groq consistently return all 10 requested fields? What happens if a field is absent?

**Decision**: Defensively render — every tab uses optional chaining (`result.field?.map`) so a missing array renders an empty state, not a crash.

**Findings**:
- LLaMA 3.3 70B reliably follows detailed system prompts when `temperature: 0.1` and `response_format: json_object` are both set.
- Occasional edge case: very short resumes may cause the model to return empty arrays for `grammarSuggestions` or `recommendedCourses`. Empty arrays are valid responses, not errors.
- The `score` field has been observed to sometimes be returned as a string `"0.75"` instead of number `0.75`. The UI should coerce: `Number(result.score)`.

**Alternatives Considered**:
- JSON Schema validation with `zod` → adds type-safety at runtime. **Recommended for production** but deferred for prototype.
- Prompt engineering to force non-empty fields → unreliable; better to handle gracefully.

---

## R-003 — PDF Parsing in Next.js App Router

**Question**: Can `pdf-parse` run in Next.js App Router API routes without issues?

**Decision**: Use `export const runtime = "nodejs"` on the API route. Parse with `pdf-parse(Buffer.from(await file.arrayBuffer()))`.

**Findings**:
- `pdf-parse` requires Node.js built-ins (`fs`, `Buffer`) and cannot run in Edge Runtime.
- `export const runtime = "nodejs"` pins the route to Node.js runtime. ✅ Verified working.
- `request.formData()` (Web API) is the correct way to parse multipart in App Router. Do **not** use `formidable` stream — it requires `req.on` (Node `IncomingMessage`) which the App Router `Request` object does not provide.
- File size: Next.js default body size limit is 4 MB. For large PDFs, `next.config.ts` must set `api.bodyParser.sizeLimit`.

**Alternatives Considered**:
- `pdfjs-dist` (Mozilla) → browser-compatible but larger bundle, more complex. Rejected for server-side use.
- `formidable` stream → broken in App Router. Already rejected in prior iterations.

---

## R-004 — MUI Glassmorphism on Dark Background

**Question**: How to achieve glassmorphism with MUI Paper/Card components on a dynamic gradient background?

**Decision**: Override MUI `Paper` and `Card` `backgroundImage: "none"` in theme, apply `.glass` CSS class manually with `backdrop-filter: blur(28px)` and semi-transparent `rgba` background.

**Findings**:
- MUI's dark mode applies a default `backgroundImage` gradient to Paper. This interferes with custom glass effect. Override with `styleOverrides: { root: { backgroundImage: "none" } }`.
- `backdrop-filter` requires both `-webkit-backdrop-filter` (Safari) and `backdrop-filter` (Chrome/Firefox) prefixes.
- The animated gradient background uses `background-size: 400% 400%` + `@keyframes gradientShift` — this is the canvas behind the glass layer.
- GPU compositing: `backdrop-filter` creates its own stacking context. All glass elements must have `position: relative` or `transform` to avoid z-index conflicts.

**Alternatives Considered**:
- MUI `sx` prop inline styles for blur → works but not reusable across components. CSS class `.glass` is cleaner.
- Solid dark backgrounds (no glass) → simpler but visually flat. Rejected per user requirement.

---

## R-005 — Scan History Persistence

**Question**: Is `data/scans.json` the right storage mechanism? What are the failure modes?

**Decision**: Keep JSON file for prototype. Append-only pattern: read → push → write.

**Findings**:
- `fs.writeFileSync` is synchronous, blocking — acceptable for prototype with single user.
- Concurrent writes (two scans simultaneously) could corrupt the file. For production, replace with SQLite (`better-sqlite3`) or a database.
- The `data/` directory must exist before first write. The route creates it with `fs.mkdirSync(..., { recursive: true })`.
- JSON file should be in `.gitignore` to avoid committing personal resume data.

**Alternatives Considered**:
- SQLite via `better-sqlite3` → better concurrency, same file-based simplicity. **Recommended for next iteration**.
- PostgreSQL/Supabase → overkill for prototype. Rejected.
- In-memory store → lost on restart. Rejected.

---

## R-006 — Testing Strategy

**Question**: What testing framework and approach should be used?

**Decision**: Jest + React Testing Library for unit/component tests. Deferred from this iteration — prototype ships without tests.

**Findings**:
- Next.js 16 works with Jest + `@testing-library/react` via `next/jest` config transformer.
- Key test scenarios to cover when tests are added:
  1. `extractKeywords()` unit test
  2. `scanWithGroq()` mock-fetch test (mock the Groq fetch, assert result shape)
  3. `POST /api/scan` integration test (mock pdf-parse + Groq)
  4. UI component test: score ring renders correct colour for given score
- No tests are required to ship the prototype per current project state.

**Alternatives Considered**:
- Vitest → faster, ESM-native. Good alternative but less Next.js documentation. Deferred.
- Playwright E2E → valuable for verifying the full submit→result flow. Recommended for production.

---

## R-007 — Score Coercion and Normalisation

**Question**: Should the score always be a float 0–1, or can it be a percentage 0–100?

**Decision**: Groq is prompted to return 0–1. The UI multiplies by 100 for display. Coerce to `Number()` defensively.

**Findings**:
- System prompt specifies `"score": <number between 0 and 1>`.
- The model occasionally returns values like `75` instead of `0.75`. 
- Defensive normalisation: if `score > 1`, divide by 100.
- Added to `page.tsx`: `const s = result.score > 1 ? result.score / 100 : result.score`.

**Alternatives Considered**:
- Always prompt for 0–100 → requires changing all comparisons. Rejected for consistency.

---

## Summary of Resolved Clarifications

| Item | Resolution |
|------|-----------|
| Groq embeddings | Does not exist — use chat completions |
| Model choice | `llama-3.3-70b-versatile` (128k context, json_object support) |
| PDF parsing runtime | Node.js runtime required (`export const runtime = "nodejs"`) |
| Multipart parsing | `request.formData()` Web API only (not formidable stream) |
| Missing Groq fields | Defensive optional chaining in UI |
| Storage | `data/scans.json` for prototype; SQLite for production |
| Testing | Deferred; Jest + RTL recommended |
| Score type | Float 0–1 with defensive normalisation |

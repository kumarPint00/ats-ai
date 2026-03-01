# Implementation Plan

## Phase 0 – Research & prep

- Review earlier extractor implementation and browse `officeparser`/`mammoth` docs.
- Investigate best way to preview various file types in the browser (FileReader,
  <object>, pdf.js).
- Draft Groq prompt wording to satisfy Q/A + self-intro requirements; iterate
  with quick manual tests.

## Phase 1 – Data model and API changes

1. Create `lib/fileTypes.ts` and update existing code to import from it.
2. Extend `ScanResult` interface and adjust `scan.ts`/`route.ts` typings.
3. Wire the new prompt into `scanWithGroq()` or create a two-step query
   (questions+answers after initial result).
4. Add server-side fallback for missing skills.

## Phase 2 – Client UI

1. Import ACCEPTED_EXTENSIONS/LABEL from `fileTypes.ts`.
2. Add `file` and `previewText` state; implement file preview component.
3. Update upload button text/tooltip.
4. Modify Interview tab rendering to group questions and show answers and intro.
5. Add empty-state message when falling back.
6. Add CSS/styling for preview pane.

## Phase 3 – Testing & polish

1. Add or update automated tests covering:
   - API response shape
   - Rate-limit/backoff unaffected
   - Preview logic (unit test for FileReader helper)
2. Manual smoke tests with PDF, DOCX, ODT, TXT files.
3. Update README and quickstart docs.
4. Run full build and fix any bundling issues (client/server boundary).

## Phase 4 – Deployment & cleanup

- Merge branch `003-enriched-output` after review.
- Rotate exposed API keys (they were leaked earlier).
- Tag release and update changelog.

---

This plan mirrors the structure used for previous features; tasks can be
checked off in `tasks.md` as they are completed.
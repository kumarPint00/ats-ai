# Tasks for Enriched Document Support & Interview Q&A

- [X] add `lib/fileTypes.ts` with ACCEPTED_EXTENSIONS / ACCEPTED_LABEL (browser-safe)
- [X] update existing extractor (`lib/extractText.ts`) to reuse constants and handle all extensions
- [X] modify API route to use extractor and extend ScanResult interface with new fields
- [X] craft Groq prompt to produce 15 questions per strong skill, answers, and self-intro
- [X] update client state/types for new `ScanResult` fields
- [X] implement file preview in `app/page.tsx` (FileReader for text, `<object>` for PDFs)
- [X] update upload button tooltip/label to show friendly ACCEPTED_LABEL
- [X] render grouped questions + toggleable answers in Interview tab; display selfIntro at top
- [X] handle fallback when no strong skills detected (legacy 10 q)
- [ ] write unit tests/automation for new behaviours (rate overview, preview, API shapes)
- [ ] run `npm run build` and manual smoke tests for PDF, DOCX, and TXT uploads
- [ ] update README.md/quickstart to mention new formats and preview feature
- [ ] commit and push changes to `003-enriched-output` branch
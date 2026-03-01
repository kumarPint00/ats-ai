# Data Model Changes

The existing `ScanResult` (see 001‑advanced‑analysis/data-model.md) is extended
with three new properties to support the enriched interview preparation:

```ts
export interface ScanResult {
  score: number;
  summary: string;
  matches: string[];
  missing: string[];
  grammarSuggestions: { original: string; suggestion: string }[];
  strongPoints: string[];
  weakPoints: string[];
  preparationGuide: string;

  // new fields:
  selfIntro: string; // two‑to‑three sentence professional introduction

  // an array of question objects. each question is tagged with the skill it
  // relates to; when no skills are detected the array contains 10 questions
  // with skill set to "generic".
  interviewQuestions: { skill: string; question: string }[];

  // map from question text to a concise answer (2‑3 sentences). the key must
  // exactly match the text in interviewQuestions so the client can look it up.
  answers: Record<string, string>;
}
```

Other types remain unchanged. The API route continues to accept the same POST
body (resume and jobDescription may be text or files) and returns the extended
`ScanResult` object.

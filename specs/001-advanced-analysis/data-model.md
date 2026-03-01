# Data Model: Advanced Resume Analysis

**Branch**: `001-advanced-analysis` | **Date**: 2026-03-01

---

## Entities

### 1. `ScanResult`

The primary value object returned by Groq and surfaced to the UI. Never persisted directly — a superset of `ScanLog`.

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `score` | `number` | ✅ | 0 ≤ score ≤ 1 | ATS keyword + semantic match score |
| `matches` | `string[]` | ✅ | ≥ 0 items | Skills/keywords present in both resume and JD |
| `missing` | `string[]` | ✅ | ≥ 0 items | Important JD keywords absent from resume |
| `summary` | `string` | ✅ | 2–3 sentences | Overall assessment paragraph |
| `grammarSuggestions` | `string[]` | ✅ | ≥ 0 items | Each item quotes original text + proposed fix |
| `strongPoints` | `string[]` | ✅ | ≥ 0 items | Resume strengths specific to this JD |
| `weakPoints` | `string[]` | ✅ | ≥ 0 items | Resume gaps specific to this JD |
| `interviewQuestions` | `string[]` | ✅ | Exactly 10 items | Tailored questions based on resume + JD |
| `recommendedCourses` | `RecommendedCourse[]` | ✅ | ≥ 0 items | Courses to bridge specific skill gaps |
| `preparationGuide` | `string[]` | ✅ | ≥ 0 items | Ordered action steps before submission/interview |

**Validation rules**:
- `score` must be coerced to float 0–1: if value > 1, divide by 100.
- All array fields default to `[]` if absent in Groq response (defensive rendering).
- `summary` defaults to `""` if absent.

**State transitions**: Stateless — created once per scan request, never mutated.

**TypeScript interface** (source of truth in `lib/scan.ts`):
```typescript
export interface ScanResult {
  score: number;
  matches: string[];
  missing: string[];
  summary: string;
  grammarSuggestions: string[];
  strongPoints: string[];
  weakPoints: string[];
  interviewQuestions: string[];
  recommendedCourses: RecommendedCourse[];
  preparationGuide: string[];
}
```

---

### 2. `RecommendedCourse`

Nested entity within `ScanResult.recommendedCourses`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | ✅ | Course or certification name |
| `reason` | `string` | ✅ | Why this course bridges a specific gap |

**TypeScript interface**:
```typescript
export interface RecommendedCourse {
  title: string;
  reason: string;
}
```

---

### 3. `ScanLog`

Persisted entry written to `data/scans.json` after each successful scan.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `createdAt` | `string` | ✅ | ISO 8601 timestamp (e.g., `2026-03-01T10:30:00.000Z`) |
| `score` | `number` | ✅ | Copied from `ScanResult.score` |
| `summary` | `string` | — | Copied from `ScanResult.summary` |

> Only `score`, `summary`, and `createdAt` are persisted. Full result arrays are not written to disk (privacy — resumes contain PII).

**JSON file format** (`data/scans.json`):
```json
[
  {
    "createdAt": "2026-03-01T10:30:00.000Z",
    "score": 0.82,
    "summary": "Strong technical match. The candidate covers 8 of 10 required skills..."
  }
]
```

---

## Relationships

```
POST /api/scan
    │
    ├─ receives ──► ResumeInput { resumeText: string, jdText: string }
    │
    ├─ calls ──────► scanWithGroq(resumeText, jdText)
    │                    └─ returns ──► ScanResult
    │                                    └─ contains ──► RecommendedCourse[]
    │
    ├─ persists ──► ScanLog (subset of ScanResult + createdAt)
    │                    └─ appended to data/scans.json
    │
    └─ responds ──► ScanResult (full object to client)


GET /api/scan
    └─ reads ──► ScanLog[] from data/scans.json
```

---

## Validation Rules

| Rule | Field | Enforcement |
|------|-------|-------------|
| Score normalisation | `score` | `score > 1 ? score / 100 : score` in UI |
| Missing array fields | all `string[]` | `?? []` fallback in UI render |
| Missing summary | `summary` | `?? ""` fallback |
| Empty arrays are valid | `grammarSuggestions` etc. | Render empty state, not error |
| createdAt format | `ScanLog.createdAt` | `new Date().toISOString()` on server |

---

## Future Entity Candidates (not in scope)

| Entity | Why Deferred |
|--------|-------------|
| `User` | No auth in prototype |
| `Session` | No multi-user support |
| `ResumeVersion` | No versioning UI |
| `JobPosting` | No JD management beyond raw text paste |

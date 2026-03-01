# API Contract: ATS Resume Scanner

**Branch**: `001-advanced-analysis` | **Date**: 2026-03-01  
**Base URL**: `http://localhost:3000` (dev) · `/` (relative, same origin in prod)  
**Runtime**: Node.js (`export const runtime = "nodejs"`)

---

## Endpoints

### POST `/api/scan`

Analyse a resume against a job description. Accepts either JSON or multipart form data.

#### Request — variant A: JSON body

```
Content-Type: application/json
```

```json
{
  "resumeText": "string (required if no resumeFile)",
  "jdText":     "string (required if no jdFile)"
}
```

#### Request — variant B: Multipart form data

```
Content-Type: multipart/form-data
```

| Field | Type | Description |
|-------|------|-------------|
| `resumeFile` | File (PDF or TXT) | Resume document — text extracted server-side |
| `jdFile` | File (PDF or TXT) | JD document — text extracted server-side |
| `resumeText` | string | Plain text fallback (used if no file uploaded) |
| `jdText` | string | Plain text fallback (used if no file uploaded) |

> File content takes precedence over the corresponding text field when both are provided.

#### Response — 200 OK

```json
{
  "score": 0.82,
  "matches": ["TypeScript", "React", "REST API"],
  "missing": ["Docker", "Kubernetes", "CI/CD"],
  "summary": "Strong technical match. The candidate covers 8 of 10 required skills with 3 years of relevant experience. Leadership skills and DevOps knowledge are the primary gaps.",
  "grammarSuggestions": [
    "\"Responsible for managing\" → prefer active voice: \"Managed a team of 4 engineers\"",
    "\"Worked with React\" is vague → \"Built 12 production React components serving 50k MAU\""
  ],
  "strongPoints": [
    "5 years TypeScript experience directly matches the JD's 'strong TypeScript skills' requirement",
    "Led a team of 4 — aligns with the 'team lead' responsibility in the JD"
  ],
  "weakPoints": [
    "No Docker or container orchestration experience — required for the DevOps duties in this role",
    "No mention of CI/CD pipelines despite being a core JD requirement"
  ],
  "interviewQuestions": [
    "Describe your experience architecting TypeScript projects at scale.",
    "How have you handled performance bottlenecks in React applications?",
    "Walk me through a time you led a team through a challenging deadline.",
    "What is your experience with RESTful API design?",
    "How would you approach learning Docker for this role?",
    "Describe your testing philosophy for frontend code.",
    "How do you stay current with the JavaScript ecosystem?",
    "Tell me about a complex bug you debugged in production.",
    "How have you collaborated with backend teams on API contracts?",
    "What would you prioritise in your first 30 days in this role?"
  ],
  "recommendedCourses": [
    {
      "title": "Docker & Kubernetes: The Practical Guide (Udemy)",
      "reason": "Bridges the container orchestration gap identified as a primary weakness"
    },
    {
      "title": "GitHub Actions CI/CD — Complete Guide",
      "reason": "Directly addresses the missing CI/CD pipeline experience required by the JD"
    }
  ],
  "preparationGuide": [
    "Rewrite all bullet points to use strong action verbs and quantified outcomes (e.g., \"Reduced load time by 40%\")",
    "Add a dedicated 'Tools & Technologies' section listing Docker, Git, CI/CD tools you have even basic exposure to",
    "Research the company's tech stack — check their GitHub and engineering blog before the interview",
    "Prepare a 2-minute 'leadership story' for the team lead questions",
    "Take the Docker quick-start tutorial (1 hour) to speak confidently about containers",
    "Prepare answers to all 10 generated interview questions before submitting your application"
  ]
}
```

#### Response — 400 Bad Request

```json
{ "error": "Both resumeText and jdText are required." }
```

#### Response — 500 Internal Server Error

```json
{ "error": "Groq API error: <details>" }
```

or

```json
{ "error": "GROQ_API_KEY is not set in your environment." }
```

---

### GET `/api/scan`

Retrieve the scan history log.

#### Request

No body, no parameters.

#### Response — 200 OK

Array of `ScanLog` entries, newest first.

```json
[
  {
    "createdAt": "2026-03-01T10:35:00.000Z",
    "score": 0.82,
    "summary": "Strong technical match..."
  },
  {
    "createdAt": "2026-03-01T09:12:00.000Z",
    "score": 0.61,
    "summary": "Moderate match with several gaps..."
  }
]
```

Returns `[]` if no scans have been recorded yet.

#### Response — 500 Internal Server Error

```json
{ "error": "Failed to read scan history." }
```

---

## Field Contracts

| Field | Guaranteed Type | Possible Values | Notes |
|-------|----------------|-----------------|-------|
| `score` | number | 0.0 – 1.0 | Normalise: if > 1, divide by 100 |
| `matches` | string[] | ≥ 0 items | May be empty |
| `missing` | string[] | ≥ 0 items | May be empty |
| `summary` | string | Non-empty string | Always present when no error |
| `grammarSuggestions` | string[] | ≥ 0 items | May be empty (clean resume) |
| `strongPoints` | string[] | ≥ 0 items | May be empty |
| `weakPoints` | string[] | ≥ 0 items | May be empty |
| `interviewQuestions` | string[] | Exactly 10 items | Prompt requests 10 |
| `recommendedCourses` | `{title,reason}[]` | ≥ 0 items | May be empty (no gaps found) |
| `preparationGuide` | string[] | ≥ 0 items | Ordered by priority |

---

## Constraints

- Max file size: 4 MB (Next.js default body limit)
- Supported file types: `.pdf`, `.txt`
- PDF must have a text layer (image-only PDFs return empty text → empty analysis)
- Requires `GROQ_API_KEY` environment variable
- Node.js runtime only (not edge-compatible)

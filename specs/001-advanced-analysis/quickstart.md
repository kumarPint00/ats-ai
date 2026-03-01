# Quickstart: ATS Resume Scanner — Advanced Analysis

**Branch**: `001-advanced-analysis` | **Date**: 2026-03-01

Get the app running locally and test the full deep-analysis flow in under 5 minutes.

---

## Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | ≥ 20.x | `node -v` |
| npm | ≥ 10.x | `npm -v` |
| Groq API key | — | [console.groq.com](https://console.groq.com) → API Keys |

---

## 1. Clone & Install

```bash
git clone <repo-url> ats-ai
cd ats-ai
npm install
```

---

## 2. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and set your Groq key:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
LLM_PROVIDER=groq
```

> **Where to get a key**: [console.groq.com](https://console.groq.com) → API Keys → Create API Key. Free tier is sufficient.

---

## 3. Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 4. Run Your First Scan

### Option A — Paste text

1. In the **Resume / CV** panel, paste any resume text (even a few bullet points).
2. In the **Job Description** panel, paste any job posting text.
3. Click **⚡ Analyse Resume**.
4. Wait up to 15 seconds for the Groq response.
5. The score ring, summary, and 7 result tabs appear.

### Option B — Upload a file

1. Click **📎 Upload PDF / TXT** under the Resume panel and select a `.pdf` or `.txt` file.
2. Repeat for the JD panel (optional).
3. Click **⚡ Analyse Resume**.

---

## 5. Explore the Result Tabs

| Tab | What you see |
|-----|-------------|
| ✅ Keywords | Matched (green chips) and missing (red chips) keywords |
| 💪 Strengths | Concrete strengths relative to this JD |
| ⚠️ Weaknesses | Gaps and areas to improve |
| ✍️ Grammar | Specific phrasing issues with suggested fixes |
| 🎤 Interview Prep | 10 tailored interview questions |
| 📚 Courses | Recommended courses/certifications with reasons |
| 🗺️ Prep Guide | Ordered action steps to take before applying/interviewing |

---

## 6. View Scan History

Click **🕘 Load scan history** at the bottom of the page. Previous scans appear as score cards with timestamps.

---

## 7. Build for Production

```bash
npm run build
npm start
```

Verify zero TypeScript errors in build output.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `GROQ_API_KEY is not set` | Missing `.env` | Copy `.env.example` → `.env` and add key |
| `Groq API error: 401` | Invalid key | Regenerate key at console.groq.com |
| Score ring shows 0% | Empty resume or JD | Ensure at least some text in both fields |
| PDF shows empty analysis | Image-only PDF | Use a PDF with a text layer, or paste text instead |
| Build fails | TypeScript error | Run `npm run build` and check error details |
| Grammar tab is empty | Clean resume | Expected — Groq returns empty array for clean text |

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq API key from console.groq.com |
| `LLM_PROVIDER` | — | Set to `groq` (default; only provider supported) |

---

## Key Source Files

| File | Purpose |
|------|---------|
| `lib/scan.ts` | `scanWithGroq()` — Groq API call + `ScanResult` interface |
| `app/api/scan/route.ts` | `POST /api/scan` (scan) + `GET /api/scan` (history) |
| `app/page.tsx` | Main UI — form, score ring, 7-tab results panel |
| `app/layout.tsx` | MUI dark theme + ThemeProvider |
| `app/globals.css` | Keyframe animations, glassmorphism, gradient body |
| `data/scans.json` | Persistent scan history (auto-created on first scan) |

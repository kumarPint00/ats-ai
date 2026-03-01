# ATS Resume Scanner

> Deep resume analysis powered by **Groq** and **LLaMA 3.3 70B** — glassmorphism UI, 7-tab insights, zero backend infra.

## Features

- 🎯 **ATS Score** — circular score ring with colour-coded match percentage
- 💪 **Strengths / ⚠️ Weaknesses** — JD-relative analysis
- ✍️ **Grammar Suggestions** — original → suggested phrasing
- 🎤 **Interview Prep** — 15 questions per core skill, grouped by skill, with interview-ready answers and a suggested self-introduction
- 📚 **Course Recommendations** — skill-gap bridging courses
- 🗺️ **Preparation Guide** — step-by-step action plan
- 🕘 **Scan History** — persistent log (no PII stored)
- 📎 **Multi-format upload & preview** – PDF, Word, ODT, PPTX, XLSX, TXT, MD, CSV, RTF; see a quick document preview before scanning

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Add your Groq API key (get one free at https://console.groq.com)
#    Edit .env.local:
#    GROQ_API_KEY=your_key_here

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## Build for Production

```bash
npm run build
npm start
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | MUI v5 dark theme + glassmorphism CSS |
| AI | Groq API · LLaMA 3.3 70B Versatile |
| PDF parsing | pdf-parse (Node.js runtime) |
| Storage | `data/scans.json` — local JSON log |

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

# Resume–JD Scanner

This project has been extended into a simple tool that compares a candidate's resume with a job description to compute a match score and identify overlapping keywords.

## Features

- Accepts plain text or PDF/TXT files for resumes and JDs
- Uses OpenAI embeddings for semantic similarity
- Returns a percentage score and lists of matched/missing keywords
- Built with Next.js, Material UI, and serverless API routes

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add environment variable:

   ```bash
   echo "OPENAI_API_KEY=your_key_here" > .env.local
   ```

3. Run the development server:

   ```bash
   npm run dev
   ```

4. Visit `http://localhost:3000` and use the form to enter text or upload files.

## API Details

`POST /api/scan` accepts either JSON or multipart form-data. When sending files, include `resumeFile` and/or `jdFile` as file fields; the server will parse PDF text automatically.

Response example:

```json
{
  "score": 0.73,
  "matches": ["javascript","react"],
  "missing": ["docker"]
}
```

## AI/ML Configuration

By default the app uses OpenAI embeddings, but you can configure other providers such as Groq. The code checks `LLM_PROVIDER` environment variable and switches accordingly. Example environment variables for Groq:

Adjust these values or remove them as appropriate for your environment.

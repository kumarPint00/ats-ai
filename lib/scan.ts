// simple keyword extraction by splitting on non-word characters and filtering stopwords
const STOPWORDS = new Set([
  "the", "and", "a", "an", "of", "to", "in", "for",
  "with", "on", "by", "is", "it", "that", "this", "as",
]);

export function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w && !STOPWORDS.has(w))
    )
  );
}

export interface RecommendedCourse {
  title: string;
  reason: string;
}

export interface ScanResult {
  score: number;
  matchedCount?: number;
  totalRequired?: number;
  matches: string[];
  missing: string[];
  summary: string;
  grammarSuggestions: string[];
  strongPoints: string[];
  weakPoints: string[];
  // each question is tagged with the skill it relates to; when no skills are
  // identified the array may contain generic questions with skill "generic".
  interviewQuestions: { skill: string; question: string }[];
  // map from question text (exact match) to a short answer (2‑3 sentences).
  answers: Record<string, string>;
  recommendedCourses: RecommendedCourse[];
  preparationGuide: string[];
  // a brief professional self‑introduction the candidate could use at interview start
  selfIntro: string;
  // actionable suggestions for resume tweaks to improve ATS score
  atsSuggestions: string[];
}

/**
 * Use the Groq chat completion API to compare a resume with a job description.
 * Returns a structured score, keyword matches and gaps.
 */
/**
 * Fetch wrapper with exponential backoff retry.
 * Retries only on transient server-side errors (429, 503).
 * Non-retriable errors (4xx other than 429) throw immediately.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  const RETRIABLE = new Set([429, 503]);
  for (let attempt = 0; attempt < retries; attempt++) {
    const resp = await fetch(url, options);
    if (resp.ok) return resp;
    if (!RETRIABLE.has(resp.status)) {
      // Non-retriable: surface immediately
      const text = await resp.text();
      throw new Error(`Groq API error: ${text}`);
    }
    if (attempt < retries - 1) {
      // 1 s, 2 s, 4 s backoff
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw new Error("AI service is busy. Please try again shortly.");
}

export async function scanWithGroq(
  resumeText: string,
  jdText: string
): Promise<ScanResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error("GROQ_API_KEY is not set in your environment.");
  }

  const systemPrompt = `You are an expert career coach and ATS analyst with 15+ years of recruiting experience.
You will receive a candidate's resume and a job description.
Perform a thorough deep-dive analysis and return ONLY valid JSON with this exact structure (no extra keys, no markdown):
{
  "score": <compute this precisely using the formula below — do NOT default to 0.85>,
  "matchedCount": <number of JD keywords/skills found in resume>,
  "totalRequired": <number of total required keywords/skills identified in the JD>,
  "matches": ["list of skills/keywords present in BOTH resume and JD"],
  "missing": ["important skills/keywords in JD that are absent from resume"],
  "summary": "2-3 sentence overall assessment of the candidate's fit",
  "grammarSuggestions": ["specific phrasing issues in the format: Original: '...' → Suggested: '...'"],

  "strongPoints": ["concrete strengths of this resume relative to the JD — be specific"],
  "weakPoints": ["concrete weaknesses or gaps — be specific and constructive"],
  "selfIntro": "a brief 2-3 sentence professional introduction the candidate could use at the start of an interview",
  "atsSuggestions": ["specific changes the candidate should make to their resume to improve the ATS score"],

  "interviewQuestions": [
     { "skill": "string", "question": "string" }
  ],
  "answers": { "<question text>": "concise answer (2-3 sentences)" },

  "recommendedCourses": [
    { "title": "Course or certification name", "reason": "Why this helps bridge a specific gap" }
  ],
  "preparationGuide": ["ordered step-by-step action items the candidate should complete before the interview"]
}

Instructions:
- SCORE FORMULA: First, extract ALL required skills/keywords from the JD (mandatory + preferred). Count how many appear in the resume → matchedCount. totalRequired = total extracted. Base score = matchedCount / totalRequired. Then apply modifiers:
  * +0.05 if the candidate's experience level matches the JD seniority
  * +0.05 if domain/industry is the same
  * -0.10 for each critical must-have skill that is missing (max -0.30)
  * -0.05 for significant experience gap (e.g. JD needs 5 yrs, resume shows 2)
  Clamp the final value between 0.10 and 0.98. Report it as a decimal (e.g. 0.72 not 72).
- Identify the "strongly required" skills mentioned in the job description and generate **between 30 and 50 total interview questions**, distributing them across those skills.
- Prefix or tag each question object with the corresponding skill name.
- After listing all questions, provide an "answers" map where each key exactly matches one of the question texts and the value is a short (2-3 sentence) interview-ready answer.
- Provide an array of "atsSuggestions" containing concrete resume edits that would help the candidate pass the ATS.
- If no strongly required skills can be detected, fall back to 10 generic questions with skill value "generic" and still supply answers and ATS suggestions.

Be specific, practical, and tailored to THIS resume and JD. Do not give generic advice.`;

  const userPrompt = `RESUME:
${resumeText}

JOB DESCRIPTION:
${jdText}`;

  const resp = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });

  const data = await resp.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content) as ScanResult;

  // ── Ground-truth keyword verification ─────────────────────────────────────
  // The LLM can hallucinate matches/missing. We verify every skill it reported
  // against the ACTUAL resume text (case-insensitive substring check).
  // Skills the LLM claimed matched but aren't in the resume → moved to missing.
  // Skills the LLM claimed were missing but ARE in the resume → moved to matches.
  const resumeLower = resumeText.toLowerCase();

  const llmMatches  = parsed.matches  ?? [];
  const llmMissing  = parsed.missing  ?? [];

  // A skill "exists in resume" if any word of it appears as a substring
  const inResume = (skill: string) => resumeLower.includes(skill.toLowerCase());

  const verifiedMatches  = llmMatches.filter(s =>  inResume(s));
  const falseMatches     = llmMatches.filter(s => !inResume(s)); // claimed matched but not found
  const verifiedMissing  = llmMissing.filter(s => !inResume(s));
  const falselyMissing   = llmMissing.filter(s =>  inResume(s)); // claimed missing but actually there

  parsed.matches = [...verifiedMatches, ...falselyMissing];
  parsed.missing = [...verifiedMissing, ...falseMatches];

  // ── Recompute score from verified match data ────────────────────────────────
  const m     = parsed.matches.length;
  const miss  = parsed.missing.length;
  const total = m + miss;
  if (total > 0) {
    const base     = m / total;
    const llmScore = parsed.score ?? 0;
    // Override if LLM score deviates >15% from reality or is the classic fixed value
    if (Math.abs(llmScore - base) > 0.15 || llmScore === 0.85) {
      parsed.score = Math.min(0.98, Math.max(0.10, parseFloat(base.toFixed(2))));
    }
  }

  return parsed;
}

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
  "score": <number 0-1 reflecting ATS keyword match and overall fit>,
  "matches": ["list of skills/keywords present in BOTH resume and JD"],
  "missing": ["important skills/keywords in JD that are absent from resume"],
  "summary": "2-3 sentence overall assessment of the candidate's fit",
  "grammarSuggestions": ["specific phrasing issues in the format: Original: '...' → Suggested: '...'"],

  "strongPoints": ["concrete strengths of this resume relative to the JD — be specific"],
  "weakPoints": ["concrete weaknesses or gaps — be specific and constructive"],
  "interviewQuestions": ["exactly 10 interview questions the hiring manager would ask this specific candidate based on their resume and the JD"],
  "recommendedCourses": [
    { "title": "Course or certification name", "reason": "Why this helps bridge a specific gap" }
  ],
  "preparationGuide": ["ordered step-by-step action items the candidate should complete before the interview"]
}
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
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  const data = await resp.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content) as ScanResult;
  return parsed;
}

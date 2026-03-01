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
  if (!key) throw new Error("GROQ_API_KEY is not set in your environment.");

  // ── Step 1: Extract keyword tokens from both documents ──────────────────────
  // These are sent alongside the full texts so the LLM can do semantic matching
  // against a structured vocabulary rather than free-reading both walls of text.
  const jdWords = extractKeywords(jdText);
  const cvWords = extractKeywords(resumeText);

  // ── Step 2: Build prompt ────────────────────────────────────────────────────
  const systemPrompt = `You are a senior ATS analyst and career coach with 15+ years of recruiting experience.

You will receive:
  1. JD EXTRACTED KEYWORDS — individual tokens pulled from the Job Description
  2. CV EXTRACTED KEYWORDS  — individual tokens pulled from the Candidate's Resume
  3. The full Job Description text
  4. The full Resume text

Perform a precise gap analysis and return ONLY valid JSON (no markdown fences, no extra keys):
{
  "score": <decimal 0.10–0.98 — see scoring rules below>,
  "matchedCount": <integer: count of matched skills>,
  "totalRequired": <integer: count of all JD skills you evaluated>,
  "matches": [
    "Skill or technology from the JD that is clearly present in the resume — use the natural skill name, e.g. 'Python', 'REST APIs', 'Agile'"
  ],
  "missing": [
    "Skill or technology required/preferred in the JD that is absent from the resume"
  ],
  "summary": "2-3 sentence overall assessment of candidate fit for this specific role",
  "grammarSuggestions": ["Resume issue — format: Original: '...' → Suggested: '...'"],
  "strongPoints": [
    "A specific skill, achievement, or experience STRONGLY demonstrated in the resume that directly matches a JD requirement — cite the resume evidence"
  ],
  "weakPoints": [
    "A specific JD requirement that the resume fails to address — be constructive, name the exact gap"
  ],
  "selfIntro": "2-3 sentence professional introduction the candidate could deliver at the start of an interview",
  "atsSuggestions": [
    "Specific, actionable ATS improvement — e.g. 'Add the exact phrase X to your skills section', 'Replace Y with industry-standard term Z', 'Quantify achievement W with numbers'"
  ],
  "interviewQuestions": [
    { "skill": "<JD skill/requirement being tested>", "question": "<behavioural or technical question>" }
  ],
  "answers": { "<exact question text>": "concise 2-3 sentence interview-ready answer" },
  "recommendedCourses": [
    { "title": "Course or certification name", "reason": "Exactly which gap this bridges" }
  ],
  "preparationGuide": ["Ordered action item the candidate should complete before the interview"]
}

SCORING RULES:
  base = matchedCount / totalRequired
  +0.05 if candidate seniority matches JD seniority
  +0.05 if candidate domain/industry matches JD
  -0.10 per critical must-have skill missing (cap at -0.30)
  -0.05 if there is a significant experience gap (e.g. JD wants 5 yrs, resume shows 2)
  Clamp result to [0.10, 0.98]. Express as decimal (0.72 not 72).

STRICT RULES:
  - MATCHES must only contain skills/phrases that appear in BOTH the JD and the resume. Do not fabricate.
  - MISSING must only contain skills/phrases required or preferred in the JD that are absent from the resume.
  - STRONG POINTS must cite actual resume content (quote or paraphrase from the resume).
  - WEAK POINTS must cite actual JD requirements that are unmet.
  - ATS SUGGESTIONS: provide at least 6 specific, concrete suggestions referencing real content from both documents.
  - INTERVIEW QUESTIONS: generate 30–50 questions, all based on JD requirements. Cover every major skill area in the JD.`;

  const userPrompt = `=== FULL JOB DESCRIPTION ===
${jdText}

=== FULL RESUME ===
${resumeText}

=== SUPPLEMENTARY: JD KEYWORD TOKENS (for reference) ===
${jdWords.join(", ")}

=== SUPPLEMENTARY: CV KEYWORD TOKENS (for reference) ===
${cvWords.join(", ")}`;

  // ── Step 3: Call Groq ───────────────────────────────────────────────────────
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
      temperature: 0.15,
      response_format: { type: "json_object" },
    }),
  });

  const data = await resp.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content) as ScanResult;

  // ── Step 4: Word-level verification ────────────────────────────────────────
  // Exact-substring checks break multi-word skills ("machine learning", "cloud
  // computing"). Instead we check at the individual-word level: a skill passes
  // if at least one of its significant words appears in the extracted keyword
  // set of the respective document.
  const jdWordSet = new Set(jdWords);
  const cvWordSet = new Set(cvWords);

  // significant words of a skill = words longer than 2 chars, not stopwords
  const sigWords = (s: string) =>
    s.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !STOPWORDS.has(w));

  const skillInJD = (s: string) => sigWords(s).some(w => jdWordSet.has(w));
  const skillInCV = (s: string) => sigWords(s).some(w => cvWordSet.has(w));

  // Combine LLM lists, dedupe, discard anything whose words don't appear in the JD
  const allSkills = [...new Set([...(parsed.matches ?? []), ...(parsed.missing ?? [])])];
  const jdSkills  = allSkills.filter(s => skillInJD(s));

  // Final split is determined purely by presence in CV — not LLM opinion
  parsed.matches = jdSkills.filter(s =>  skillInCV(s));
  parsed.missing = jdSkills.filter(s => !skillInCV(s));

  // ── Step 5: Recompute score from verified lists ─────────────────────────────
  const m     = parsed.matches.length;
  const miss  = parsed.missing.length;
  const total = m + miss;
  if (total > 0) {
    const base     = m / total;
    const llmScore = parsed.score ?? 0;
    if (Math.abs(llmScore - base) > 0.15 || llmScore === 0.85) {
      parsed.score = Math.min(0.98, Math.max(0.10, parseFloat(base.toFixed(2))));
    }
  }

  return parsed;
}

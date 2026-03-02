// simple keyword extraction by splitting on non-word characters and filtering stopwords
const STOPWORDS = new Set([
  "the", "and", "a", "an", "of", "to", "in", "for",
  "with", "on", "by", "is", "it", "that", "this", "as",
  "are", "was", "were", "be", "been", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "shall", "can", "not", "no", "or", "but",
]);

export function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w))
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

// ── Shared Groq call helper ────────────────────────────────────────────────
async function callGroq(key: string, systemPrompt: string, userPrompt: string): Promise<any> {
  const resp = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt  },
      ],
      temperature: 0.15,
      response_format: { type: "json_object" },
    }),
  });
  const data = await resp.json();
  return JSON.parse(data.choices[0].message.content);
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-AGENT scanWithGroq
//
//  Agent 1 (sequential)  – Gap Analyst
//    Sole job: read the JD, list every required skill, decide which are in the
//    CV and which aren't. Nothing else.
//
//  Agents 2, 3, 4 (parallel, run after Agent 1 to use its output)
//    Agent 2 – Resume Quality Analyst  (strengths, weaknesses, grammar, ATS tips)
//    Agent 3 – Interview Coach         (questions + answers, based on JD only)
//    Agent 4 – Career Advisor          (summary, courses, prep guide)
//
//  Score is computed server-side from Agent 1's verified lists.
// ─────────────────────────────────────────────────────────────────────────────
export async function scanWithGroq(
  resumeText: string,
  jdText: string
): Promise<ScanResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set in your environment.");

  const jdWords = extractKeywords(jdText);
  const cvWords = extractKeywords(resumeText);
  const jdWordSet = new Set(jdWords);
  const cvWordSet = new Set(cvWords);

  const sigWords = (s: string) =>
    s.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
  const skillInJD = (s: string) => sigWords(s).some(w => jdWordSet.has(w));
  const skillInCV = (s: string) => sigWords(s).some(w => cvWordSet.has(w));

  // ── AGENT 1: Gap Analyst ────────────────────────────────────────────────────
  const gap = await callGroq(
    key,
    `You are a strict ATS keyword gap analyst. Your ONLY job is to compare a Job Description against a Resume and identify skill/keyword matches and gaps.

Return ONLY valid JSON — no markdown, no explanation:
{
  "jdSkills": ["every distinct skill, technology, tool, methodology, or qualification mentioned in the JD"],
  "matches":  ["skills from jdSkills that are clearly present in the resume"],
  "missing":  ["skills from jdSkills that are absent from the resume"],
  "matchedCount": <integer>,
  "totalRequired": <integer>,
  "score": <decimal 0.10-0.98: matchedCount/totalRequired with these modifiers:
    +0.05 if seniority level matches, +0.05 if same domain,
    -0.10 per critical missing must-have (max -0.30), -0.05 for major experience gap>
}

RULES:
- Every item in "matches" MUST appear in BOTH the JD and the resume. Read both carefully.
- Every item in "missing" MUST be required/preferred in the JD and absent from the resume.
- Do NOT invent skills. Only use what is actually written in the texts.
- jdSkills is the union of matches + missing.`,
    `=== FULL JOB DESCRIPTION ===\n${jdText}\n\n=== FULL RESUME ===\n${resumeText}`
  );

  // Server-side word-level verification of Agent 1's output
  const allSkills  = [...new Set([...(gap.matches ?? []), ...(gap.missing ?? [])])];
  const jdSkills   = allSkills.filter(s => skillInJD(s));
  const matches    = jdSkills.filter(s =>  skillInCV(s));
  const missing    = jdSkills.filter(s => !skillInCV(s));

  const m     = matches.length;
  const miss  = missing.length;
  const total = m + miss;
  const base  = total > 0 ? m / total : 0.5;
  const llmScore = gap.score ?? 0;
  const score = (total > 0 && Math.abs(llmScore - base) > 0.15) || llmScore === 0.85
    ? Math.min(0.98, Math.max(0.10, parseFloat(base.toFixed(2))))
    : llmScore;

  // ── AGENTS 2, 3, 4 in parallel ─────────────────────────────────────────────
  const matchedList  = matches.join(", ") || "none identified";
  const missingList  = missing.join(", ") || "none identified";

  const [quality, interview, career] = await Promise.all([

    // ── AGENT 2: Resume Quality Analyst ──────────────────────────────────────
    callGroq(
      key,
      `You are a professional resume reviewer and ATS specialist.

You will receive a resume, a job description, and pre-computed lists of matched and missing skills.

Return ONLY valid JSON:
{
  "strongPoints": [
    "A strength DIRECTLY EVIDENCED in the resume text that satisfies a JD requirement. Quote or paraphrase the resume. Min 5 items."
  ],
  "weakPoints": [
    "A specific JD requirement that the resume fails to address. Name the exact gap. Min 3 items."
  ],
  "grammarSuggestions": [
    "Resume language issue — format: Original: '...' → Suggested: '...'"
  ],
  "atsSuggestions": [
    "Concrete, specific ATS fix referencing actual content from both documents. Min 6 items. Examples: 'Add the phrase X to your skills section', 'Replace Y with industry-standard term Z', 'Quantify the achievement W with metrics'."
  ]
}

RULES:
- strongPoints must cite evidence from the resume text. No generic statements.
- weakPoints must cite requirements from the JD text. No generic statements.
- atsSuggestions must be actionable and specific to THIS resume + JD pair.`,
      `=== JOB DESCRIPTION ===\n${jdText}\n\n=== RESUME ===\n${resumeText}\n\n=== MATCHED SKILLS ===\n${matchedList}\n\n=== MISSING SKILLS ===\n${missingList}`
    ),

    // ── AGENT 3: Interview Coach ──────────────────────────────────────────────
    callGroq(
      key,
      `You are a technical interview coach preparing a candidate for a specific role.

You will receive only the Job Description. Generate interview questions based purely on what the JD requires.

Return ONLY valid JSON:
{
  "selfIntro": "A 2-3 sentence professional self-introduction tailored to this specific role that the candidate can deliver at interview start",
  "interviewQuestions": [
    { "skill": "<exact JD requirement or skill area being tested>", "question": "<specific behavioural or technical question>" }
  ],
  "answers": {
    "<exact question text>": "Concise 2-3 sentence interview-ready answer using STAR format where applicable"
  }
}

RULES:
- Generate between 30 and 50 questions.
- Every question must map to a real requirement in the JD.
- Distribute questions across ALL major skill areas listed in the JD.
- The "answers" object must have one key per question, matching the question text exactly.
- Do NOT ask generic questions unrelated to this JD.`,
      `=== FULL JOB DESCRIPTION ===\n${jdText}`
    ),

    // ── AGENT 4: Career Advisor ───────────────────────────────────────────────
    callGroq(
      key,
      `You are a career advisor giving an honest, data-driven assessment of a candidate's fit for a specific role.

You will receive the job description, the resume, pre-computed matched/missing skill lists, and the ATS score.

Return ONLY valid JSON:
{
  "summary": "2-3 sentence honest, score-calibrated assessment — see tone rules below",
  "recommendedCourses": [
    { "title": "Specific course, certification, or resource name", "reason": "Exactly which missing skill from the gap list this addresses" }
  ],
  "preparationGuide": [
    "Specific, ordered action item the candidate should complete before the interview — reference actual gaps or JD requirements"
  ]
}

TONE RULES based on ATS score (provided below):
  - Score < 0.50 : Candidate is a weak match. State clearly they are missing critical skills. Do NOT use "strong candidate".
  - Score 0.50–0.74 : Candidate is a partial match. Acknowledge both strengths and significant gaps honestly.
  - Score 0.74–0.92 : Candidate is a moderate match. Positive but note important gaps.
  - Score >= 0.92 : Candidate is a strong match. Highlight strengths, briefly mention minor gaps.

RULES:
- summary MUST reflect the score range above. If score < 0.60, do not call the candidate "strong".
- summary must mention the candidate's name (if detectable), the specific role, their single best matched skill, and their most critical missing skill.
- recommendedCourses must each map to a specific item from the MISSING SKILLS list. Min 3 items.
- preparationGuide must be ordered by priority and specific to this JD. Min 5 items.`,
      `=== ATS SCORE ===\n${score} (${Math.round(score * 100)}% match — ${m} of ${total} JD skills found in resume)\n\n=== JOB DESCRIPTION ===\n${jdText}\n\n=== RESUME ===\n${resumeText}\n\n=== MATCHED SKILLS ===\n${matchedList}\n\n=== MISSING SKILLS ===\n${missingList}`
    ),
  ]);

  // ── Assemble final result ───────────────────────────────────────────────────
  return {
    score,
    matchedCount: m,
    totalRequired: total,
    matches,
    missing,
    summary:            career.summary            ?? "",
    grammarSuggestions: quality.grammarSuggestions ?? [],
    strongPoints:       quality.strongPoints       ?? [],
    weakPoints:         quality.weakPoints         ?? [],
    atsSuggestions:     quality.atsSuggestions     ?? [],
    selfIntro:          interview.selfIntro        ?? "",
    interviewQuestions: interview.interviewQuestions ?? [],
    answers:            interview.answers          ?? {},
    recommendedCourses: career.recommendedCourses  ?? [],
    preparationGuide:   career.preparationGuide    ?? [],
  };
}

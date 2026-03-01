import { NextResponse } from "next/server";
import { scanWithGroq } from "../../../lib/scan";
import { checkRateLimit } from "../../../lib/rateLimit";
import { scanSemaphore } from "../../../lib/semaphore";
import { extractText } from "../../../lib/extractText";
import { connectMongo } from "../../../lib/mongo";

// basic candidate info extractor from resume text
const extractBasicInfo = (text: string) => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const emailMatch = text.match(/[\w.-]+@[\w.-]+/);
  const phoneMatch = text.match(/\+?\d[\d\s\-]{7,}\d/);
  return {
    name: lines[0] || null,
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
  };
};

// helper to append CORS headers to every response
const withCors = (res: NextResponse) => {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
};

// convenience wrapper for NextResponse.json that also adds CORS headers
const json = (body: any, opts?: Parameters<typeof NextResponse.json>[1]) => {
  const res = NextResponse.json(body, opts);
  return withCors(res);
};

// ensure nodejs runtime so document parsers can access Node.js APIs
export const runtime = "nodejs";

// respond to CORS preflight requests so that POSTs from other origins succeed
export function OPTIONS() {
  const res = NextResponse.json({}, { status: 204 });
  return withCors(res);
}

export async function POST(request: Request) {
  // ── T007: Per-IP rate limiting ─────────────────────────────────────────────
  const ip =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const { limited, retryAfter } = checkRateLimit(ip);
  if (limited) {
    return json(
      { error: `Rate limit exceeded. Try again in ${retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    let resumeText: string | undefined;
    let jdText: string | undefined;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const rText = formData.get("resumeText");
      const jText = formData.get("jdText");
      resumeText = typeof rText === "string" ? rText : rText?.toString();
      jdText = typeof jText === "string" ? jText : jText?.toString();

      const resumeFile = formData.get("resumeFile") as any;
      if (resumeFile && typeof resumeFile.arrayBuffer === "function") {
        const buf = Buffer.from(await resumeFile.arrayBuffer());
        resumeText = await extractText(buf, resumeFile.name ?? "resume");
        if (!resumeText) {
          return json(
            { error: "Could not extract text from the resume file. If it is a scanned image, please paste the text instead." },
            { status: 400 }
          );
        }
      }
      const jdFileObj = formData.get("jdFile") as any;
      if (jdFileObj && typeof jdFileObj.arrayBuffer === "function") {
        const buf = Buffer.from(await jdFileObj.arrayBuffer());
        jdText = await extractText(buf, jdFileObj.name ?? "jd");
        if (!jdText) {
          return json(
            { error: "Could not extract text from the job description file. If it is a scanned image, please paste the text instead." },
            { status: 400 }
          );
        }
      }
    } else {
      const body = await request.json();
      resumeText = body.resumeText;
      jdText = body.jdText;
    }

    if (typeof resumeText !== "string" || typeof jdText !== "string") {
      return json({ error: "Invalid input" }, { status: 400 });
    }

    if (!resumeText.trim() || !jdText.trim()) {
      return json(
        { error: "Both resumeText and jdText are required." },
        { status: 400 }
      );
    }

    // ── T010: Concurrency semaphore — cap at 5 simultaneous Groq calls ────────
    await scanSemaphore.acquire();
    let result;
    try {
      result = await scanWithGroq(resumeText, jdText);
    } finally {
      scanSemaphore.release();
    }

    // ── Persist candidate record in MongoDB if configured
    try {
      const { name, email, phone } = extractBasicInfo(resumeText);
      const mongo = await connectMongo();
      await mongo.collection("scans").insertOne({
        name,
        email,
        phone,
        resumeText,
        jdText,
        score: result.score,
        summary: result.summary,
        // store entire result object so we have everything returned by the AI
        result,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("mongo insert failed", e);
    }

    return json(result);
  } catch (err: any) {
    console.error("scan error", err);
    if (err?.stack) console.error(err.stack);

    // ── T009 / T011: Map well-known errors to correct HTTP status codes ────────
    if (err?.message?.includes("AI service is busy")) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err?.message?.includes("Server is busy")) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }

    return json(
      { error: err.message || "server error" },
      { status: 500 }
    );
  }
}

// ── GET /api/scan — return scan history from MongoDB ────────────────────────────
export async function GET() {
  try {
    const mongo = await connectMongo();
    const scans = await mongo
      .collection("scans")
      .find({}, { projection: { _id: 0, score: 1, summary: 1, name: 1, email: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return json(scans);
  } catch (err: any) {
    console.error("read log error", err);
    return json({ error: "unable to read log" }, { status: 500 });
  }
}

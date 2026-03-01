import { NextResponse } from "next/server";
import { scanWithGroq } from "../../../lib/scan";
import { checkRateLimit } from "../../../lib/rateLimit";
import { scanSemaphore } from "../../../lib/semaphore";
import { appendScan, getAllScans } from "../../../lib/db";

import { extractText } from "../../../lib/extractText";

// ensure nodejs runtime so document parsers can access Node.js APIs
export const runtime = "nodejs";

export async function POST(request: Request) {
  // ── T007: Per-IP rate limiting ─────────────────────────────────────────────
  const ip =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const { limited, retryAfter } = checkRateLimit(ip);
  if (limited) {
    return NextResponse.json(
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
          return NextResponse.json(
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
          return NextResponse.json(
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
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (!resumeText.trim() || !jdText.trim()) {
      return NextResponse.json(
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

    // ── T012: Atomic SQLite log write (replaces scans.json) ───────────────────
    try {
      appendScan(result.score, result.summary);
    } catch (e) {
      console.warn("failed to write scan log", e);
    }

    return NextResponse.json(result);
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

    return NextResponse.json(
      { error: err.message || "server error" },
      { status: 500 }
    );
  }
}

// ── T013: GET /api/scan — return scan history from SQLite ─────────────────────
export async function GET() {
  try {
    const scans = getAllScans();
    return NextResponse.json(scans);
  } catch (err: any) {
    console.error("read log error", err);
    return NextResponse.json({ error: "unable to read log" }, { status: 500 });
  }
}

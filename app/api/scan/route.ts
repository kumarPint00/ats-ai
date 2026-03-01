import { NextResponse } from "next/server";
import { scanWithGroq } from "../../../lib/scan";

import fs from "fs";
import pdfParse from "pdf-parse";

// ensure nodejs runtime so formidable can access the underlying request
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let resumeText: string | undefined;
    let jdText: string | undefined;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // use the built-in Web FormData API available on Next.js request
      const formData = await request.formData();
      const rText = formData.get("resumeText");
      const jText = formData.get("jdText");
      resumeText = typeof rText === "string" ? rText : rText?.toString();
      jdText = typeof jText === "string" ? jText : jText?.toString();

      const resumeFile = formData.get("resumeFile") as any;
      if (resumeFile && typeof resumeFile.arrayBuffer === "function") {
        const buf = Buffer.from(await resumeFile.arrayBuffer());
        const data = await pdfParse(buf);
        resumeText = data.text;
        if (!resumeText?.trim()) {
          return NextResponse.json(
            { error: "Resume PDF appears to be image-only — no text could be extracted. Please paste text instead." },
            { status: 400 }
          );
        }
      }
      const jdFileObj = formData.get("jdFile") as any;
      if (jdFileObj && typeof jdFileObj.arrayBuffer === "function") {
        const buf = Buffer.from(await jdFileObj.arrayBuffer());
        const data = await pdfParse(buf);
        jdText = data.text;
        if (!jdText?.trim()) {
          return NextResponse.json(
            { error: "Job description PDF appears to be image-only — no text could be extracted. Please paste text instead." },
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
      return NextResponse.json({ error: "Both resumeText and jdText are required." }, { status: 400 });
    }

    // call Groq chat completion to analyse the resume against the JD
    const result = await scanWithGroq(resumeText, jdText);

    // append minimal log — no PII (data-model.md: only score + summary + timestamp)
    try {
      const logDir = "data";
      const logFile = `${logDir}/scans.json`;
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      let arr: any[] = [];
      if (fs.existsSync(logFile)) {
        const existing = fs.readFileSync(logFile, "utf-8");
        arr = JSON.parse(existing);
      }
      arr.push({ score: result.score, summary: result.summary, createdAt: new Date().toISOString() });
      fs.writeFileSync(logFile, JSON.stringify(arr, null, 2));
    } catch (e) {
      console.warn("failed to write log", e);
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("scan error", err);
    if (err && err.stack) console.error(err.stack);
    return NextResponse.json({ error: err.message || "server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const logFile = "data/scans.json";
    if (!fs.existsSync(logFile)) {
      return NextResponse.json([], { status: 200 });
    }
    const content = fs.readFileSync(logFile, "utf-8");
    const arr = JSON.parse(content);
    return NextResponse.json(arr);
  } catch (err: any) {
    console.error("read log error", err);
    return NextResponse.json({ error: "unable to read log" }, { status: 500 });
  }
}

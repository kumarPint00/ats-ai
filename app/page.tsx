"use client";

import { useState } from "react";
import { ACCEPTED_EXTENSIONS, ACCEPTED_LABEL } from "../lib/fileTypes";
import type { ScanResult } from "../lib/scan";
// mammoth has a browser build; we'll load it dynamically when needed
import mammoth from "mammoth";
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  Chip,
} from "@mui/material";

export default function Home() {
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | any>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [resumePreview, setResumePreview] = useState<string>("");
  const [jdPreview, setJdPreview] = useState<string>("");
  const [activeTab, setActiveTab] = useState(0);

  const processFile = async (file: File, setter: (f: File | null) => void, previewSetter: (s: string) => void) => {
    setter(file);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    // some formats are binary but can be converted to text client-side
    if (ext === "doc" || ext === "docx") {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value || "";
        previewSetter(text);
      } catch (err) {
        console.error("mammoth preview failed", err);
        previewSetter(`Could not preview .${ext} file.`);
      }
      return;
    }
    const binaryFormats = ["odt", "ods", "odp", "pptx", "xlsx"];
    if (binaryFormats.includes(ext)) {
      previewSetter(`Preview not available for .${ext} files.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      previewSetter(String(reader.result));
    };
    if (/\.pdf$/i.test(file.name)) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setActiveTab(0);
    try {
      let res: Response;
      if (resumeFile || jdFile) {
        const form = new FormData();
        if (resumeFile) form.append("resumeFile", resumeFile);
        if (jdFile) form.append("jdFile", jdFile);
        form.append("resumeText", resume);
        form.append("jdText", jd);
        res = await fetch("/api/scan", { method: "POST", body: form });
      } else {
        res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeText: resume, jdText: jd }),
        });
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setResult({ error: "Failed to scan. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/scan");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  const scoreColor = (score: number) =>
    score >= 0.75 ? "#4ade80" : score >= 0.5 ? "#fb923c" : "#f87171";

  const scoreLabel = (score: number) =>
    score >= 0.75 ? "Excellent Match" : score >= 0.5 ? "Good Match" : "Needs Work";

  const normScore = (s: number) => (s > 1 ? s / 100 : s);

  // group questions by skill for the Interview tab
  const groupedQuestions: Record<string, { skill: string; question: string }[]> =
    result?.interviewQuestions?.reduce(
      (acc: Record<string, { skill: string; question: string }[]>, q: any) => {
        const arr = acc[q.skill] || [];
        arr.push(q);
        acc[q.skill] = arr;
        return acc;
      },
      {} as Record<string, { skill: string; question: string }[]>
    ) || {};

  const TABS = [
    "✅ Keywords",
    "💪 Strengths",
    "⚠️ Weaknesses",
    "🛠️ ATS Tips",
    "✍️ Grammar",
    "🎤 Interview Prep",
    "📚 Courses",
    "🗺️ Prep Guide",
  ];

  const inputFields = [
    {
      label: "Resume / CV",
      value: resume,
      setter: setResume,
      file: resumeFile,
      fileSetter: (f: File | null) => f && processFile(f, setResumeFile, setResumePreview),
      color: "#818cf8",
      preview: resumePreview,
    },
    {
      label: "Job Description",
      value: jd,
      setter: setJd,
      file: jdFile,
      fileSetter: (f: File | null) => f && processFile(f, setJdFile, setJdPreview),
      color: "#38bdf8",
      preview: jdPreview,
    },
  ];

  return (
    <Box className="page-bg" sx={{ minHeight: "100vh", py: 6 }}>
      <Container maxWidth="lg">

        {/* ── Header ── */}
        <Box className="fade-in-up" sx={{ textAlign: "center", mb: 6 }}>
          <Typography
            variant="h2"
            sx={{
              fontWeight: 900,
              letterSpacing: "-2px",
              background: "linear-gradient(135deg, #a78bfa 0%, #818cf8 40%, #38bdf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              mb: 1.5,
              lineHeight: 1.1,
            }}
          >
            ATS Resume Scanner
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.38)", fontSize: "0.95rem", letterSpacing: 0.5 }}>
            Deep resume analysis · Powered by Groq · LLaMA&nbsp;3.3&nbsp;70B · PDF, Word, ODT, TXT&nbsp;&amp;&nbsp;more
          </Typography>
        </Box>

        {/* ── Input card ── */}
        <Box className="glass fade-in-up" sx={{ p: { xs: 3, md: 4 }, mb: 4, borderRadius: "24px" }}>
          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 3,
            }}
          >
            {inputFields.map(({ label, value, setter, file, fileSetter, color, preview }) => (
              <Box key={label} sx={{ display: "flex", flexDirection: "column" }}>
                <Typography
                  variant="overline"
                  sx={{ color, mb: 1, letterSpacing: 2.5, fontSize: "0.68rem", fontWeight: 700 }}
                >
                  {label}
                </Typography>
                <TextField
                  multiline
                  minRows={9}
                  fullWidth
                  placeholder={`Paste ${label.toLowerCase()} here…`}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  sx={{
                    mb: 1.5,
                    "& .MuiOutlinedInput-root": {
                      color: "#e2e8f0",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: "14px",
                      fontSize: "0.88rem",
                      lineHeight: 1.7,
                      "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
                      "&:hover fieldset": { borderColor: `${color}66` },
                      "&.Mui-focused fieldset": { borderColor: color },
                    },
                    "& textarea::placeholder": { color: "rgba(255,255,255,0.18)", opacity: 1 },
                  }}
                />
                <Button
                  variant="outlined"
                  component="label"
                  size="small"
                  title={ACCEPTED_LABEL}
                  sx={{
                    alignSelf: "start",
                    borderRadius: "8px",
                    borderColor: "rgba(255,255,255,0.14)",
                    color: "rgba(255,255,255,0.4)",
                    fontSize: "0.76rem",
                    "&:hover": { borderColor: color, color, background: `${color}11` },
                    transition: "all 0.25s",
                  }}
                >
                  📎 Upload Document
                  <input
                    type="file"
                    hidden
                    accept={ACCEPTED_EXTENSIONS}
                    onChange={(e) => e.target.files?.[0] && fileSetter(e.target.files[0])}
                  />
                </Button>
                {file && (
                  <Typography variant="caption" sx={{ mt: 0.5, color, fontSize: "0.75rem" }}>
                    {file.name}
                  </Typography>
                )}
                {file && preview && (
                  <Box sx={{ mt: 1, p: 1, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 1, maxHeight: 240, overflow: "auto" }}>
                    {/\.pdf$/i.test(file.name) ? (
                      <object data={preview} type="application/pdf" width="100%" height="240px" />
                    ) : (
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem", margin: 0 }}>
                        {preview}
                      </pre>
                    )}
                  </Box>
                )}
              </Box>
            ))}

            <Box sx={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", mt: 1 }}>
              <Button
                type="submit"
                disabled={loading}
                className="glow-btn"
                sx={{
                  px: 7,
                  py: 1.5,
                  borderRadius: "50px",
                  fontSize: "0.98rem",
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #818cf8, #38bdf8)",
                  color: "#fff",
                  letterSpacing: 0.5,
                  transition: "all 0.3s ease",
                  "&:hover": {
                    background: "linear-gradient(135deg, #38bdf8, #818cf8)",
                    transform: "translateY(-3px)",
                  },
                  "&:disabled": { opacity: 0.45, transform: "none" },
                }}
              >
                {loading ? (
                  <CircularProgress size={22} sx={{ color: "#fff" }} />
                ) : (
                  "⚡ Analyse Resume"
                )}
              </Button>
            </Box>
          </Box>
        </Box>

        {/* ── Loading Shimmer ── */}
        {loading && (
          <Box className="fade-in-up" sx={{ mt: 2 }}>
            <Box className="shimmer glass" sx={{ height: 240, borderRadius: "24px", mb: 3 }} />
            <Box className="shimmer glass" sx={{ height: 340, borderRadius: "24px" }} />
          </Box>
        )}

        {/* ── Error ── */}
        {result?.error && (
          <Typography sx={{ color: "#f87171", textAlign: "center", mb: 4 }}>
            {result.error}
          </Typography>
        )}

        {/* ── Results ── */}
        {result && !result.error && (
          <Box className="fade-in-up">

            {/* Score banner */}
            <Box
              className="glass"
              sx={{ p: { xs: 3, md: 5 }, mb: 3, borderRadius: "24px", textAlign: "center" }}
            >
              <Box sx={{ display: "inline-flex", position: "relative", mb: 2.5 }}>
                {/* track ring */}
                <CircularProgress
                  variant="determinate"
                  value={100}
                  size={160}
                  thickness={3.5}
                  sx={{ color: "rgba(255,255,255,0.07)", position: "absolute", top: 0, left: 0 }}
                />
                {/* score ring */}
                <CircularProgress
                  variant="determinate"
                  value={normScore(result.score) * 100}
                  size={160}
                  thickness={3.5}
                  className="score-ring"
                  sx={{ color: scoreColor(normScore(result.score)) }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography
                    variant="h3"
                    sx={{ fontWeight: 900, color: scoreColor(normScore(result.score)), lineHeight: 1 }}
                  >
                    {(normScore(result.score) * 100).toFixed(0)}%
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "rgba(255,255,255,0.38)", fontSize: "0.62rem", letterSpacing: 1.5, mt: 0.3 }}
                  >
                    {scoreLabel(normScore(result.score))}
                  </Typography>
                </Box>
              </Box>

              {result.summary && (
                <Typography
                  sx={{
                    color: "rgba(255,255,255,0.7)",
                    maxWidth: 640,
                    mx: "auto",
                    lineHeight: 1.85,
                    fontSize: "0.95rem",
                  }}
                >
                  {result.summary}
                </Typography>
              )}
            </Box>

            {/* Tabs panel */}
            <Box className="glass" sx={{ borderRadius: "24px", overflow: "hidden" }}>
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Resume analysis results"
                sx={{
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  "& .MuiTab-root": {
                    color: "rgba(255,255,255,0.32)",
                    minHeight: 58,
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    letterSpacing: 0.3,
                    transition: "color 0.2s",
                  },
                  "& .Mui-selected": { color: "#818cf8 !important" },
                  "& .MuiTabs-indicator": {
                    background: "linear-gradient(90deg, #818cf8, #38bdf8)",
                    height: 3,
                    borderRadius: "3px 3px 0 0",
                  },
                  "& .MuiTabs-scrollButtons": { color: "rgba(255,255,255,0.25)" },
                }}
              >
                {TABS.map((label) => (
                  <Tab key={label} label={label} aria-label={label} />
                ))}
              </Tabs>

              <Box sx={{ p: { xs: 2, md: 3 }, minHeight: 240 }}>

                {/* ── Tab 0: Keywords ── */}
                {activeTab === 0 && (
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
                    <Box>
                      <Typography sx={{ color: "#4ade80", fontWeight: 700, mb: 2, fontSize: "0.88rem" }}>
                        ✅ Matched Keywords
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {result.matches?.map((k: string) => (
                          <Chip
                            key={k}
                            label={k}
                            size="small"
                            sx={{
                              background: "rgba(74,222,128,0.1)",
                              color: "#4ade80",
                              border: "1px solid rgba(74,222,128,0.28)",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                            }}
                          />
                        ))}
                        {(!result.matches || result.matches.length === 0) && (
                          <Typography sx={{ color: "rgba(255,255,255,0.3)" }}>No keyword matches found.</Typography>
                        )}
                      </Box>
                    </Box>
                    <Box>
                      <Typography sx={{ color: "#f87171", fontWeight: 700, mb: 2, fontSize: "0.88rem" }}>
                        ❌ Missing Keywords
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {result.missing?.map((k: string) => (
                          <Chip
                            key={k}
                            label={k}
                            size="small"
                            sx={{
                              background: "rgba(248,113,113,0.1)",
                              color: "#f87171",
                              border: "1px solid rgba(248,113,113,0.28)",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                            }}
                          />
                        ))}
                        {(!result.missing || result.missing.length === 0) && (
                          <Typography sx={{ color: "rgba(255,255,255,0.3)" }}>No missing keywords — great alignment!</Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* ── Tab 1: Strong points ── */}
                {activeTab === 1 && (
                  <List disablePadding>
                    {result.strongPoints?.map((p: string, i: number) => (
                      <ListItem
                        key={i}
                        sx={{
                          px: 0,
                          py: 1.2,
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          "&:last-child": { borderBottom: "none" },
                        }}
                      >
                        <Box sx={{ mr: 2, color: "#4ade80", flexShrink: 0, fontSize: "1rem" }}>✦</Box>
                        <ListItemText
                          primary={p}
                          primaryTypographyProps={{ sx: { color: "rgba(255,255,255,0.82)", fontSize: "0.9rem", lineHeight: 1.65 } }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}

                {/* ── Tab 2: Weak points ── */}
                {activeTab === 2 && (
                  <List disablePadding>
                    {result.weakPoints?.map((p: string, i: number) => (
                      <ListItem
                        key={i}
                        sx={{
                          px: 0,
                          py: 1.2,
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          "&:last-child": { borderBottom: "none" },
                        }}
                      >
                        <Box sx={{ mr: 2, color: "#fb923c", flexShrink: 0, fontSize: "1rem" }}>◆</Box>
                        <ListItemText
                          primary={p}
                          primaryTypographyProps={{ sx: { color: "rgba(255,255,255,0.82)", fontSize: "0.9rem", lineHeight: 1.65 } }}
                        />
                      </ListItem>
                    ))}
                    {(!result.weakPoints || result.weakPoints.length === 0) && (
                      <Typography sx={{ color: "rgba(255,255,255,0.3)", py: 3, textAlign: "center" }}>No significant weaknesses identified — strong overall match!</Typography>
                    )}
                  </List>
                )}

                {/* ── Tab 3: ATS tips ── */}
                {activeTab === 3 && (
                  <List disablePadding>
                    {result.atsSuggestions?.map((s: string, i: number) => (
                      <ListItem
                        key={i}
                        sx={{
                          px: 0,
                          py: 1.5,
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          "&:last-child": { borderBottom: "none" },
                        }}
                      >
                        <Box sx={{ mr: 2, color: "#fbbf24", flexShrink: 0, fontSize: "1rem" }}>🛠️</Box>
                        <ListItemText
                          primary={s}
                          primaryTypographyProps={{ sx: { color: "rgba(255,255,255,0.82)", fontSize: "0.9rem", lineHeight: 1.65 } }}
                        />
                      </ListItem>
                    ))}
                    {(!result.atsSuggestions || result.atsSuggestions.length === 0) && (
                      <Typography sx={{ color: "rgba(255,255,255,0.3)", py: 3, textAlign: "center" }}>No ATS-specific suggestions provided.</Typography>
                    )}
                  </List>
                )}

                {/* ── Tab 3: Grammar ── */}
                {activeTab === 4 && (
                  <List disablePadding>
                    {result.grammarSuggestions?.map((s: string, i: number) => (
                      <ListItem
                        key={i}
                        sx={{
                          px: 0,
                          py: 1.2,
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          "&:last-child": { borderBottom: "none" },
                        }}
                      >
                        <Box sx={{ mr: 2, color: "#818cf8", flexShrink: 0, fontSize: "1.1rem" }}>✎</Box>
                        <ListItemText
                          primary={s}
                          primaryTypographyProps={{ sx: { color: "rgba(255,255,255,0.82)", fontSize: "0.9rem", lineHeight: 1.65 } }}
                        />
                      </ListItem>
                    ))}
                    {(!result.grammarSuggestions || result.grammarSuggestions.length === 0) && (
                      <Typography sx={{ color: "rgba(255,255,255,0.3)", py: 3, textAlign: "center" }}>✅ No grammar issues found — your resume reads cleanly.</Typography>
                    )}
                  </List>
                )}

                {/* ── Tab 4: Interview questions ── */}
                {activeTab === 5 && (
                  <Box>
                    {result.selfIntro && (
                      <Typography sx={{ color: "rgba(255,255,255,0.82)", mb: 2 }}>
                        {result.selfIntro}
                      </Typography>
                    )}
                    {Object.keys(groupedQuestions).length > 0 ? (
                      Object.entries(groupedQuestions).map(([skill, qs]) => (
                        <Box key={skill} sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" sx={{ color: "rgba(255,255,255,0.6)", mb: 1 }}>
                            {skill}
                          </Typography>
                          <List disablePadding>
                            {qs.map((q, idx) => (
                              <ListItem
                                key={idx}
                                sx={{
                                  px: 0,
                                  py: 1.5,
                                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                                  "&:last-child": { borderBottom: "none" },
                                  alignItems: "flex-start",
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: "50%",
                                    background: "linear-gradient(135deg, #818cf8, #38bdf8)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    mr: 2,
                                    flexShrink: 0,
                                    mt: 0.15,
                                  }}
                                >
                                  <Typography sx={{ fontSize: "0.68rem", color: "#fff", fontWeight: 800 }}>
                                    {idx + 1}
                                  </Typography>
                                </Box>
                                <ListItemText
                                  primary={q.question}
                                  primaryTypographyProps={{ sx: { color: "rgba(255,255,255,0.82)", fontSize: "0.9rem", lineHeight: 1.65 } }}
                                  secondary={
                                    result.answers?.[q.question] ? (
                                      <Typography
                                        variant="body2"
                                        sx={{ color: "rgba(255,255,255,0.48)", mt: 0.5 }}
                                      >
                                        {result.answers[q.question]}
                                      </Typography>
                                    ) : null
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      ))
                    ) : (
                      <Typography sx={{ color: "rgba(255,255,255,0.3)", py: 3, textAlign: "center" }}>
                        No interview questions generated.
                      </Typography>
                    )}
                  </Box>
                )}

                {/* ── Tab 5: Courses ── */}
                {activeTab === 6 && (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
                      gap: 2,
                    }}
                  >
                    {result.recommendedCourses?.map((c: { title: string; reason: string }, i: number) => (
                      <Box
                        key={i}
                        sx={{
                          p: 2.5,
                          borderRadius: "16px",
                          background: "rgba(129,140,248,0.07)",
                          border: "1px solid rgba(129,140,248,0.18)",
                          transition: "all 0.25s ease",
                          "&:hover": {
                            background: "rgba(129,140,248,0.14)",
                            borderColor: "rgba(129,140,248,0.35)",
                            transform: "translateY(-3px)",
                            boxShadow: "0 8px 24px rgba(129,140,248,0.2)",
                          },
                        }}
                      >
                        <Typography sx={{ color: "#c4b5fd", fontWeight: 700, mb: 0.8, fontSize: "0.88rem" }}>
                          📘 {c.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.48)", fontSize: "0.8rem", lineHeight: 1.6 }}>
                          {c.reason}
                        </Typography>
                      </Box>
                    ))}
                    {(!result.recommendedCourses || result.recommendedCourses.length === 0) && (
                      <Typography sx={{ color: "rgba(255,255,255,0.3)", py: 3, textAlign: "center", gridColumn: "1 / -1" }}>🎉 No specific courses needed — your skills align well with this role.</Typography>
                    )}
                  </Box>
                )}

                {/* ── Tab 6: Prep guide ── */}
                {activeTab === 7 && (
                  <List disablePadding>
                    {result.preparationGuide?.map((step: string, i: number) => (
                      <ListItem
                        key={i}
                        sx={{
                          px: 0,
                          py: 1.5,
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          "&:last-child": { borderBottom: "none" },
                          alignItems: "flex-start",
                        }}
                      >
                        <Box
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: "10px",
                            background:
                              i % 2 === 0
                                ? "linear-gradient(135deg, #818cf8, #c4b5fd)"
                                : "linear-gradient(135deg, #38bdf8, #818cf8)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mr: 2,
                            flexShrink: 0,
                          }}
                        >
                          <Typography sx={{ fontSize: "0.78rem", color: "#fff", fontWeight: 800 }}>
                            {i + 1}
                          </Typography>
                        </Box>
                        <ListItemText
                          primary={step}
                          primaryTypographyProps={{ sx: { color: "rgba(255,255,255,0.82)", lineHeight: 1.75, fontSize: "0.9rem" } }}
                        />
                      </ListItem>
                    ))}
                    {(!result.preparationGuide || result.preparationGuide.length === 0) && (
                      <Typography sx={{ color: "rgba(255,255,255,0.3)", py: 3, textAlign: "center" }}>No preparation steps generated.</Typography>
                    )}
                  </List>
                )}

              </Box>
            </Box>
          </Box>
        )}

        {/* ── History ── */}
        <Box sx={{ mt: 6, textAlign: "center" }}>
          <Button
            onClick={loadHistory}
            sx={{
              color: "rgba(255,255,255,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 50,
              px: 3,
              py: 0.8,
              fontSize: "0.8rem",
              "&:hover": { borderColor: "#818cf8", color: "#818cf8", background: "rgba(129,140,248,0.06)" },
              transition: "all 0.25s",
            }}
          >
            🕘 Load scan history
          </Button>

          {history && (
            <Box sx={{ mt: 2.5, display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
              {history.map((item, i) => (
                <Box
                  key={i}
                  className="glass"
                  sx={{ p: 2, borderRadius: "14px", minWidth: 150, textAlign: "left" }}
                >
                  <Typography sx={{ color: scoreColor(item.score), fontWeight: 800, fontSize: "1.15rem" }}>
                    {(item.score * 100).toFixed(1)}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)", display: "block", fontSize: "0.72rem" }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

      </Container>
    </Box>
  );
}

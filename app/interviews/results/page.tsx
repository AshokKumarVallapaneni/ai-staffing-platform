"use client";

import { useEffect, useState } from "react";

type InterviewAnswer = {
  id: string;
  question: string;
  answer_text: string | null;
  feedback: string | null;
  score: number | null;
  technical_score: number | null;
  communication_score: number | null;
  confidence_score: number | null;
  question_source: string | null;
};

type CodingAnswer = {
  id: string;
  language: string | null;
  question: string | null;
  source_code: string | null;
  execution_result: string | null;
  score: number | null;
  feedback: string | null;
};

type InterviewResult = {
  id: string;
  status: string;
  completed_at: string | null;
  overall_score: number | null;
  technical_score: number | null;
  communication_score: number | null;
  coding_score: number | null;
  consultants: {
    full_name: string;
    email: string;
    profile_type: string;
    seniority: string;
    experience_years: number;
  };
  interview_answers: InterviewAnswer[];
  interview_coding_answers: CodingAnswer[];
};

export default function InterviewResultsPage() {
  const [results, setResults] = useState<InterviewResult[]>([]);
  const [expandedId, setExpandedId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const loadResults = async () => {
    const res = await fetch("/api/interviews/results");
    const data = await res.json();

    if (res.ok) {
      setResults(data.results || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadResults();
  }, []);

  const avg = (items: (number | null)[]) => {
    const nums = items.filter((x): x is number => typeof x === "number");
    if (nums.length === 0) return "N/A";
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  };

  if (loading) {
    return <div style={page}>Loading results...</div>;
  }

  return (
    <div style={page}>
      <div style={hero}>
        <h1 style={title}>Interview Results</h1>
        <p>
          Completed interviews with candidate answers, AI feedback, scores, and
          live coding validation.
        </p>
      </div>

      {results.length === 0 && (
        <div style={card}>No completed interviews found.</div>
      )}

      {results.map((r) => {
        const answers = r.interview_answers || [];
        const codingAnswers = r.interview_coding_answers || [];

        const technicalAvg = avg(answers.map((a) => a.technical_score));
        const communicationAvg = avg(answers.map((a) => a.communication_score));
        const confidenceAvg = avg(answers.map((a) => a.confidence_score));
        const codingAvg = avg(codingAnswers.map((c) => c.score));

        return (
          <div key={r.id} style={card}>
            <div style={topRow}>
              <div>
                <h2 style={{ margin: 0 }}>
                  {r.consultants?.full_name || "Candidate"}
                </h2>
                <p style={muted}>
                  {r.consultants?.profile_type || "Profile N/A"} •{" "}
                  {r.consultants?.email || "Email N/A"}
                </p>
                <p style={muted}>
                  Completed:{" "}
                  {r.completed_at
                    ? new Date(r.completed_at).toLocaleString()
                    : "N/A"}
                </p>
              </div>

              <button
                style={button}
                onClick={() =>
                  setExpandedId(expandedId === r.id ? "" : r.id)
                }
              >
                {expandedId === r.id ? "Hide Details" : "View Details"}
              </button>
            </div>

            <div style={scoreGrid}>
              <Score label="Technical" value={technicalAvg} />
              <Score label="Communication" value={communicationAvg} />
              <Score label="Confidence" value={confidenceAvg} />
              <Score label="Coding" value={codingAvg} />
              <Score label="Questions" value={answers.length} />
            </div>

            {expandedId === r.id && (
              <div style={{ marginTop: "18px" }}>
                <h3>Interview Q&A</h3>

                {answers.map((a, index) => (
                  <div key={a.id} style={qaCard}>
                    <div style={questionHeader}>
                      <strong>Question {index + 1}</strong>
                      <span style={badge}>{a.question_source || "N/A"}</span>
                    </div>

                    <p>
                      <strong>Question:</strong> {a.question}
                    </p>

                    <div style={answerBox}>
                      <strong>Candidate Answer:</strong>
                      <p>{a.answer_text || "No answer provided."}</p>
                    </div>

                    <div style={feedbackBox}>
                      <strong>AI Feedback:</strong>
                      <p>{a.feedback || "No feedback available."}</p>
                    </div>

                    <div style={smallScores}>
                      <span>Technical: {a.technical_score ?? "N/A"}</span>
                      <span>Communication: {a.communication_score ?? "N/A"}</span>
                      <span>Confidence: {a.confidence_score ?? "N/A"}</span>
                    </div>
                  </div>
                ))}

                {codingAnswers.length > 0 && (
                  <div style={{ marginTop: "28px" }}>
                    <h3>Live Coding Results</h3>

                    {codingAnswers.map((c, index) => (
                      <div key={c.id} style={qaCard}>
                        <div style={questionHeader}>
                          <strong>Coding Question {index + 1}</strong>
                          <span style={badge}>{c.language || "Code"}</span>
                        </div>

                        <p>
                          <strong>Question:</strong> {c.question || "N/A"}
                        </p>

                        <div style={codeBox}>
                          <strong>Submitted Code:</strong>
                          <pre style={pre}>
                            {c.source_code || "No code submitted."}
                          </pre>
                        </div>

                        <div style={feedbackBox}>
                          <strong>AI Coding Feedback:</strong>
                          <p>{c.feedback || "No feedback available."}</p>
                        </div>

                        <div style={smallScores}>
                          <span>Coding Score: {c.score ?? "N/A"}</span>
                          <span>
                            Execution Result: {c.execution_result || "N/A"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Score({ label, value }: { label: string | number; value: string | number }) {
  return (
    <div style={scoreCard}>
      <div style={scoreValue}>{value}</div>
      <div style={scoreLabel}>{label}</div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "36px",
  background: "#f8fafc",
};

const hero: React.CSSProperties = {
  background: "linear-gradient(135deg,#2563eb,#7c3aed)",
  color: "#fff",
  padding: "28px",
  borderRadius: "16px",
  marginBottom: "24px",
};

const title: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: "bold",
  margin: 0,
};

const card: React.CSSProperties = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  marginBottom: "18px",
  boxShadow: "0 8px 24px rgba(15,23,42,.08)",
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
};

const muted: React.CSSProperties = {
  color: "#64748b",
  margin: "6px 0",
};

const button: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  fontWeight: "bold",
  cursor: "pointer",
};

const scoreGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "12px",
  marginTop: "16px",
};

const scoreCard: React.CSSProperties = {
  background: "#f1f5f9",
  borderRadius: "10px",
  padding: "14px",
};

const scoreValue: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#2563eb",
};

const scoreLabel: React.CSSProperties = {
  color: "#475569",
};

const qaCard: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "16px",
  marginBottom: "12px",
};

const questionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "10px",
};

const badge: React.CSSProperties = {
  background: "#e0f2fe",
  color: "#075985",
  borderRadius: "999px",
  padding: "4px 9px",
  fontSize: "12px",
  fontWeight: "bold",
};

const answerBox: React.CSSProperties = {
  background: "#f8fafc",
  padding: "12px",
  borderRadius: "10px",
  marginTop: "10px",
};

const codeBox: React.CSSProperties = {
  background: "#0f172a",
  color: "#e5e7eb",
  padding: "12px",
  borderRadius: "10px",
  marginTop: "10px",
};

const pre: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  marginTop: "10px",
  fontSize: "13px",
};

const feedbackBox: React.CSSProperties = {
  background: "#fff7ed",
  padding: "12px",
  borderRadius: "10px",
  marginTop: "10px",
};

const smallScores: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  marginTop: "10px",
  fontWeight: "bold",
  flexWrap: "wrap",
};
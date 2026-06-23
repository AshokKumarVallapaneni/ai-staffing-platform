"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";

export default function CodingRoundPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [language, setLanguage] = useState("csharp");
  const [question, setQuestion] = useState(
    "Write a function to find the second highest number in an integer array."
  );
  const [sourceCode, setSourceCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [error, setError] = useState("");

  const submitCode = async () => {
    setLoading(true);
    setError("");
    setEvaluation(null);

    const res = await fetch("/api/interviews/code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        language,
        question,
        sourceCode,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to submit code.");
      return;
    }

    setEvaluation(data.evaluation);
  };

  return (
    <div style={page}>
      <div style={hero}>
        <h1 style={title}>Live Coding Round</h1>
        <p>Complete the coding problem below. Your code will be evaluated for correctness, readability, edge cases, and complexity.</p>
      </div>

      <div style={card}>
        <label style={label}>Language</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={input}>
          <option value="csharp">C#</option>
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="java">Java</option>
          <option value="python">Python</option>
          <option value="sql">SQL</option>
        </select>

        <label style={label}>Coding Question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          style={{ ...input, width: "100%" }}
        />

        <div style={{ marginTop: "16px", border: "1px solid #ddd" }}>
          <Editor
            height="420px"
            language={language}
            theme="vs-dark"
            value={sourceCode}
            onChange={(value) => setSourceCode(value || "")}
          />
        </div>

        <button onClick={submitCode} disabled={loading} style={button}>
          {loading ? "Evaluating..." : "Submit Code"}
        </button>

        <button
          onClick={() => router.push(`/interviews/session/${sessionId}`)}
          style={{ ...button, background: "#475569", marginLeft: "10px" }}
        >
          Back to Interview
        </button>

        {error && <div style={errorBox}>{error}</div>}

        {evaluation && (
          <div style={resultBox}>
            <h2>Code Evaluation</h2>
            <p><strong>Score:</strong> {evaluation.score}</p>
            <p><strong>Feedback:</strong> {evaluation.feedback}</p>
            <p><strong>Execution Result:</strong> {evaluation.executionResult}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "36px",
  background: "#f8fafc",
};

const hero: React.CSSProperties = {
  background: "linear-gradient(135deg,#0f766e,#2563eb)",
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
  padding: "24px",
  borderRadius: "14px",
  boxShadow: "0 8px 24px rgba(15,23,42,.08)",
};

const label: React.CSSProperties = {
  display: "block",
  fontWeight: "bold",
  marginBottom: "6px",
  marginTop: "12px",
};

const input: React.CSSProperties = {
  padding: "11px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  marginBottom: "10px",
};

const button: React.CSSProperties = {
  marginTop: "18px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "12px 18px",
  cursor: "pointer",
  fontWeight: "bold",
};

const errorBox: React.CSSProperties = {
  marginTop: "16px",
  padding: "14px",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: "10px",
};

const resultBox: React.CSSProperties = {
  marginTop: "18px",
  padding: "16px",
  background: "#ecfdf5",
  color: "#065f46",
  borderRadius: "10px",
};
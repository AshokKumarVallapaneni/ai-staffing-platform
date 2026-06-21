"use client";

import { useState } from "react";

type UploadedQuestion = {
  id: string;
  question_text: string;
  profile_type: string;
  technology: string;
  sub_technology: string;
  category: string;
  difficulty: string;
  question_type: string;
  confidence_score?: number;
};

export default function QuestionUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [questions, setQuestions] = useState<UploadedQuestion[]>([]);
  const [error, setError] = useState("");

  const uploadQuestions = async () => {
    setLoading(true);
    setMessage("");
    setError("");
    setQuestions([]);

    if (!file) {
      setError("Please select a file.");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("question_file", file);

    const res = await fetch("/api/questions/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Upload failed.");
      return;
    }

    setMessage(`Extracted ${data.extractedCount} question(s), inserted ${data.insertedCount} question(s).`);
    setQuestions(data.questions || []);
  };

  return (
    <div style={page}>
      <div style={hero}>
        <h1 style={title}>Question Bank Bulk Upload</h1>
        <p style={subtitle}>
          Upload Excel, CSV, or TXT files. The Question Intelligence Agent will auto-detect profile type,
          technology, difficulty, expected concepts, follow-ups, and confidence score.
        </p>
      </div>

      <div style={card}>
        <div style={uploadBox}>
          <div>
            <strong>Upload Question File</strong>
            <p style={{ color: "#64748b", margin: "6px 0 0" }}>
              Supported formats: .xlsx, .xls, .csv, .txt
            </p>
          </div>

          <input
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <button onClick={uploadQuestions} disabled={loading} style={primaryButton}>
            {loading ? "Uploading..." : "Upload Questions"}
          </button>
        </div>

        {file && (
          <div style={fileBadge}>
            Selected File: <strong>{file.name}</strong>
          </div>
        )}

        {error && <div style={errorBox}>{error}</div>}
        {message && <div style={successBox}>{message}</div>}
      </div>

      {questions.length > 0 && (
        <div style={tableCard}>
          <h2 style={sectionTitle}>Uploaded Questions</h2>

          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={{ ...th, minWidth: "420px" }}>Question</th>
                  <th style={th}>Profile</th>
                  <th style={th}>Technology</th>
                  <th style={th}>Sub Technology</th>
                  <th style={th}>Category</th>
                  <th style={th}>Difficulty</th>
                  <th style={th}>Type</th>
                  <th style={th}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td style={td}>{q.question_text}</td>
                    <td style={td}>{q.profile_type}</td>
                    <td style={td}>{q.technology}</td>
                    <td style={td}>{q.sub_technology}</td>
                    <td style={td}>{q.category}</td>
                    <td style={td}>
                      <Badge text={q.difficulty} color="#b45309" bg="#fef3c7" />
                    </td>
                    <td style={td}>{q.question_type}</td>
                    <td style={td}>
                      <Badge
                        text={String(q.confidence_score ?? 0)}
                        color={(q.confidence_score ?? 0) >= 90 ? "#15803d" : "#b45309"}
                        bg={(q.confidence_score ?? 0) >= 90 ? "#dcfce7" : "#fef3c7"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{ background: bg, color, padding: "5px 9px", borderRadius: "999px", fontWeight: 700, fontSize: "12px" }}>
      {text}
    </span>
  );
}

const page: React.CSSProperties = { padding: "36px", maxWidth: "1300px", margin: "0 auto", background: "#f8fafc", minHeight: "100vh" };
const hero: React.CSSProperties = { background: "linear-gradient(135deg,#0f766e,#2563eb)", color: "#fff", padding: "28px", borderRadius: "16px", marginBottom: "24px" };
const title: React.CSSProperties = { fontSize: "32px", fontWeight: "bold", margin: 0 };
const subtitle: React.CSSProperties = { marginTop: "10px", maxWidth: "850px", lineHeight: 1.5 };
const card: React.CSSProperties = { background: "#fff", padding: "24px", borderRadius: "14px", boxShadow: "0 8px 24px rgba(15,23,42,.08)", marginBottom: "24px" };
const uploadBox: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr auto", alignItems: "center", gap: "18px", padding: "20px", border: "1px dashed #94a3b8", borderRadius: "14px", background: "#f1f5f9" };
const primaryButton: React.CSSProperties = { padding: "12px 18px", background: "#111827", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const fileBadge: React.CSSProperties = { marginTop: "16px", background: "#eff6ff", color: "#1d4ed8", padding: "12px", borderRadius: "10px" };
const errorBox: React.CSSProperties = { marginTop: "16px", padding: "14px", background: "#fee2e2", color: "#991b1b", borderRadius: "10px" };
const successBox: React.CSSProperties = { marginTop: "16px", padding: "14px", background: "#dcfce7", color: "#166534", borderRadius: "10px" };
const tableCard: React.CSSProperties = { background: "#fff", padding: "24px", borderRadius: "14px", boxShadow: "0 8px 24px rgba(15,23,42,.08)" };
const sectionTitle: React.CSSProperties = { fontSize: "22px", fontWeight: "bold", marginBottom: "12px" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "14px" };
const th: React.CSSProperties = { border: "1px solid #e2e8f0", padding: "10px", textAlign: "left" };
const td: React.CSSProperties = { border: "1px solid #e2e8f0", padding: "10px", verticalAlign: "top" };
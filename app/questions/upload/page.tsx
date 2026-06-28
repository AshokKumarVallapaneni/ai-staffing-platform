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

  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");

  const uploadQuestions = async () => {
    setLoading(true);
    setMessage("");
    setError("");
    setQuestions([]);
    setProgress(0);
    setProgressText("");

    if (!file) {
      setError("Please select a file.");
      setLoading(false);
      return;
    }

    try {
      setProgress(10);
      setProgressText("Preparing uploaded file...");

      const formData = new FormData();
      formData.append("question_file", file);

      setProgress(30);
      setProgressText("Uploading file and extracting questions...");

      const res = await fetch("/api/questions/upload", {
        method: "POST",
        body: formData,
      });

      setProgress(75);
      setProgressText("AI tagging and saving questions...");

      const data = await res.json();

      if (!res.ok) {
        setProgress(0);
        setProgressText("");
        setError(data.error || "Upload failed.");
        setLoading(false);
        return;
      }

      setProgress(100);
      setProgressText("Upload completed successfully.");

      setMessage(
        `Extracted ${data.extractedCount} question(s), inserted ${data.insertedCount} question(s).`
      );

      setQuestions(data.questions || []);
    } catch (err) {
      setProgress(0);
      setProgressText("");
      setError("Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={page}>
      <div style={hero}>
        <h1 style={title}>Question Bank Bulk Upload</h1>
        <p style={subtitle}>
          Upload Excel, CSV, or TXT file with interview questions. The Question
          Intelligence Agent will auto-detect profile, technology, difficulty,
          concepts, and follow-ups.
        </p>
      </div>

      <div style={card}>
        <label style={label}>Upload Question File</label>

        <input
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={fileInput}
        />

        {file && (
          <div style={fileBox}>
            Selected File: <strong>{file.name}</strong>
          </div>
        )}

        <button onClick={uploadQuestions} disabled={loading} style={button}>
          {loading ? "Uploading..." : "Upload Questions"}
        </button>

        {progress > 0 && (
          <div style={progressWrapper}>
            <div style={progressLabel}>
              {progressText} {progress}%
            </div>

            <div style={progressTrack}>
              <div
                style={{
                  ...progressFill,
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>
        )}

        {error && <div style={errorBox}>{error}</div>}

        {message && <div style={successBox}>{message}</div>}
      </div>

      {questions.length > 0 && (
        <div style={resultCard}>
          <h2 style={{ marginTop: 0 }}>Uploaded Questions Preview</h2>

          <div style={questionGrid}>
            {questions.map((q) => (
              <div key={q.id} style={questionCard}>
                <h3 style={questionText}>{q.question_text}</h3>

                <div style={metaGrid}>
                  <Info label="Profile" value={q.profile_type} />
                  <Info label="Technology" value={q.technology} />
                  <Info label="Sub Tech" value={q.sub_technology} />
                  <Info label="Category" value={q.category} />
                  <Info label="Difficulty" value={q.difficulty} />
                  <Info label="Type" value={q.question_type} />
                  <Info
                    label="Confidence"
                    value={String(q.confidence_score ?? "N/A")}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div style={infoLabel}>{label}</div>
      <div style={infoValue}>{value || "N/A"}</div>
    </div>
  );
}

const page: React.CSSProperties = {
  padding: "36px",
  background: "#f8fafc",
  minHeight: "100vh",
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

const subtitle: React.CSSProperties = {
  marginTop: "10px",
  maxWidth: "850px",
  lineHeight: 1.5,
};

const card: React.CSSProperties = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  boxShadow: "0 8px 24px rgba(15,23,42,.08)",
  marginBottom: "24px",
};

const label: React.CSSProperties = {
  display: "block",
  fontWeight: "bold",
  marginBottom: "10px",
};

const fileInput: React.CSSProperties = {
  display: "block",
  marginBottom: "14px",
};

const fileBox: React.CSSProperties = {
  padding: "12px",
  background: "#f1f5f9",
  borderRadius: "10px",
  marginBottom: "14px",
};

const button: React.CSSProperties = {
  padding: "12px 18px",
  background: "#111827",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontWeight: "bold",
  cursor: "pointer",
};

const progressWrapper: React.CSSProperties = {
  marginTop: "18px",
};

const progressLabel: React.CSSProperties = {
  marginBottom: "8px",
  fontWeight: "bold",
  color: "#334155",
};

const progressTrack: React.CSSProperties = {
  width: "100%",
  height: "12px",
  background: "#e5e7eb",
  borderRadius: "999px",
  overflow: "hidden",
};

const progressFill: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg,#2563eb,#7c3aed)",
  transition: "width 0.3s ease",
};

const errorBox: React.CSSProperties = {
  marginTop: "16px",
  padding: "14px",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: "10px",
};

const successBox: React.CSSProperties = {
  marginTop: "16px",
  padding: "14px",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: "10px",
};

const resultCard: React.CSSProperties = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  boxShadow: "0 8px 24px rgba(15,23,42,.08)",
};

const questionGrid: React.CSSProperties = {
  display: "grid",
  gap: "14px",
};

const questionCard: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "16px",
  background: "#fff",
};

const questionText: React.CSSProperties = {
  fontSize: "16px",
  marginTop: 0,
  lineHeight: 1.5,
};

const metaGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "12px",
};

const infoLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#64748b",
  fontWeight: "bold",
};

const infoValue: React.CSSProperties = {
  marginTop: "4px",
  fontSize: "13px",
};
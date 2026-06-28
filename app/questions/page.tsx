"use client";

import { useEffect, useState } from "react";

type Question = {
  id: string;
  question_text: string;
  profile_type: string;
  technology: string;
  sub_technology: string;
  category: string;
  sub_category: string;
  difficulty: string;
  question_type: string;
  source_type: string;
  expected_answer: string | null;
  expected_concepts?: string[] | null;
  follow_up_templates?: string[] | null;
  confidence_score: number;
  review_status: string;
  is_active: boolean;
  client_name: string | null;
  role_name: string | null;
};

type Stats = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  lowConfidence: number;
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [viewQuestion, setViewQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [profileType, setProfileType] = useState("");
  const [technology, setTechnology] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [lowConfidence, setLowConfidence] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const [stats, setStats] = useState<Stats>({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    lowConfidence: 0,
  });

  const [error, setError] = useState("");

  const loadQuestions = async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("pageSize", pageSize.toString());

    if (search) params.append("search", search);
    if (profileType) params.append("profile_type", profileType);
    if (technology) params.append("technology", technology);
    if (difficulty) params.append("difficulty", difficulty);
    if (reviewStatus) params.append("review_status", reviewStatus);
    if (lowConfidence) params.append("lowConfidence", "true");

    const res = await fetch(`/api/questions?${params.toString()}`);
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to load questions.");
      return;
    }

    setQuestions(data.questions || []);
    setTotalCount(data.totalCount || 0);
    setStats(data.stats || stats);
    setSelectedIds([]);
  };

  useEffect(() => {
    loadQuestions();
  }, [page, lowConfidence]);

  const searchQuestions = () => {
    setPage(1);
    loadQuestions();
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const bulkUpdate = async (updateData: {
    review_status?: string;
    is_active?: boolean;
  }) => {
    if (selectedIds.length === 0) {
      alert("Please select at least one question.");
      return;
    }

    const res = await fetch("/api/questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selectedIds,
        ...updateData,
      }),
    });

    if (res.ok) loadQuestions();
  };

  const toggleActive = async (question: Question) => {
    const res = await fetch("/api/questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: question.id,
        is_active: !question.is_active,
      }),
    });

    if (res.ok) loadQuestions();
  };

  const updateReviewStatus = async (id: string, status: string) => {
    const res = await fetch("/api/questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        review_status: status,
      }),
    });

    if (res.ok) loadQuestions();
  };

  const saveEditQuestion = async () => {
    if (!editingQuestion) return;

    const res = await fetch("/api/questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingQuestion),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to save question.");
      return;
    }

    setEditingQuestion(null);
    loadQuestions();
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    const res = await fetch(`/api/questions?id=${id}`, {
      method: "DELETE",
    });

    if (res.ok) loadQuestions();
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return "#15803d";
    if (score >= 70) return "#d97706";
    return "#dc2626";
  };

  const getConfidenceBg = (score: number) => {
    if (score >= 90) return "#dcfce7";
    if (score >= 70) return "#fef3c7";
    return "#fee2e2";
  };

  const getReviewColor = (status: string) => {
    if (status === "Approved") return "#15803d";
    if (status === "Rejected") return "#dc2626";
    return "#d97706";
  };

  const getReviewBg = (status: string) => {
    if (status === "Approved") return "#dcfce7";
    if (status === "Rejected") return "#fee2e2";
    return "#fef3c7";
  };

  const getDifficultyColor = (value: string) => {
    if (value === "Easy") return { color: "#15803d", bg: "#dcfce7" };
    if (value === "Medium") return { color: "#b45309", bg: "#fef3c7" };
    if (value === "Hard") return { color: "#dc2626", bg: "#fee2e2" };
    if (value === "Expert") return { color: "#7c3aed", bg: "#ede9fe" };
    return { color: "#334155", bg: "#e2e8f0" };
  };

  const startRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalCount);

  return (
    <div style={pageStyle}>
      <div style={hero}>
        <h1 style={title}>Question Bank</h1>
        <p style={subtitle}>
          Manage real interview questions, AI-tagged categories, confidence scores,
          approval status, and active questions used by the Interview Agent.
        </p>
      </div>

      <div style={statsGrid}>
        <StatCard label="Total Questions" value={stats.total} color="#2563eb" />
        <StatCard label="Approved" value={stats.approved} color="#15803d" />
        <StatCard label="Pending" value={stats.pending} color="#d97706" />
        <StatCard label="Rejected" value={stats.rejected} color="#dc2626" />
        <StatCard label="Low Confidence" value={stats.lowConfidence} color="#7c3aed" />
      </div>

      <div style={card}>
        <div style={filterGrid}>
          <input placeholder="Search question..." value={search} onChange={(e) => setSearch(e.target.value)} style={input} />
          <input placeholder="Profile Type" value={profileType} onChange={(e) => setProfileType(e.target.value)} style={input} />
          <input placeholder="Technology" value={technology} onChange={(e) => setTechnology(e.target.value)} style={input} />

          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={input}>
            <option value="">All Difficulty</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
            <option value="Expert">Expert</option>
          </select>

          <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} style={input}>
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          <button onClick={searchQuestions} style={primaryButton}>Search</button>
        </div>

        <div style={toolbar}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={lowConfidence}
              onChange={(e) => {
                setPage(1);
                setLowConfidence(e.target.checked);
              }}
            />
            Low Confidence Only
          </label>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={() => bulkUpdate({ review_status: "Approved" })} style={{ ...smallButton, background: "#15803d" }}>
              Approve Selected
            </button>
            <button onClick={() => bulkUpdate({ review_status: "Rejected" })} style={{ ...smallButton, background: "#b45309" }}>
              Reject Selected
            </button>
            <button onClick={() => bulkUpdate({ is_active: false })} style={smallButton}>
              Deactivate Selected
            </button>
            <span style={{ padding: "6px 0", fontWeight: "bold" }}>
              Selected: {selectedIds.length}
            </span>
          </div>
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <div style={{ marginBottom: "12px", fontWeight: "bold" }}>
          {loading ? "Loading..." : `${totalCount} question(s) found`}
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          <div style={selectAllBox}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={
                  questions.length > 0 &&
                  questions.every((q) => selectedIds.includes(q.id))
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds([
                      ...new Set([
                        ...selectedIds,
                        ...questions.map((q) => q.id),
                      ]),
                    ]);
                  } else {
                    setSelectedIds(
                      selectedIds.filter(
                        (id) => !questions.some((q) => q.id === id)
                      )
                    );
                  }
                }}
              />
              Select All on this page
            </label>
          </div>

          {questions.map((q) => {
            const diff = getDifficultyColor(q.difficulty);

            return (
              <div key={q.id} style={questionCard}>
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(q.id)}
                    onChange={() => toggleSelectOne(q.id)}
                    style={{ marginTop: "6px" }}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={questionText}>{q.question_text}</div>

                    <div style={metaGrid}>
                      <Info label="Profile" value={q.profile_type} />
                      <Info label="Technology" value={q.technology} />
                      <Info label="Sub Tech" value={q.sub_technology} />
                      <Info label="Category" value={q.category} />
                      <Info label="Sub Category" value={q.sub_category} />
                      <Info label="Type" value={q.question_type} />
                      <Info label="Source" value={q.source_type} />
                      <Info label="Client" value={q.client_name || ""} />
                      <Info label="Role" value={q.role_name || ""} />
                    </div>

                    <div style={badgeRow}>
                      <Badge text={q.difficulty || "N/A"} color={diff.color} bg={diff.bg} />
                      <Badge
                        text={`Confidence ${q.confidence_score ?? 0}`}
                        color={getConfidenceColor(q.confidence_score || 0)}
                        bg={getConfidenceBg(q.confidence_score || 0)}
                      />
                      <Badge
                        text={q.review_status || "Pending"}
                        color={getReviewColor(q.review_status || "Pending")}
                        bg={getReviewBg(q.review_status || "Pending")}
                      />
                      <Badge
                        text={q.is_active ? "Active" : "Inactive"}
                        color={q.is_active ? "#15803d" : "#dc2626"}
                        bg={q.is_active ? "#dcfce7" : "#fee2e2"}
                      />
                    </div>
                  </div>
                </div>

                <div style={cardActions}>
                  <button onClick={() => setViewQuestion(q)} style={{ ...actionButton, background: "#0f766e" }}>View</button>
                  <button onClick={() => setEditingQuestion(q)} style={{ ...actionButton, background: "#2563eb" }}>Edit</button>
                  <button onClick={() => updateReviewStatus(q.id, "Approved")} style={{ ...actionButton, background: "#15803d" }}>Approve</button>
                  <button onClick={() => updateReviewStatus(q.id, "Rejected")} style={{ ...actionButton, background: "#b45309" }}>Reject</button>
                  <button onClick={() => toggleActive(q)} style={actionButton}>{q.is_active ? "Deactivate" : "Activate"}</button>
                  <button onClick={() => deleteQuestion(q.id)} style={{ ...actionButton, background: "#991b1b" }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={pagination}>
          <div>Showing {startRow} - {endRow} of {totalCount}</div>

          <div>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} style={{ ...smallButton, opacity: page === 1 ? 0.5 : 1 }}>
              Previous
            </button>

            <span style={{ margin: "0 15px" }}>Page {page}</span>

            <button disabled={page * pageSize >= totalCount} onClick={() => setPage((p) => p + 1)} style={{ ...smallButton, opacity: page * pageSize >= totalCount ? 0.5 : 1 }}>
              Next
            </button>
          </div>
        </div>
      </div>

      {viewQuestion && (
        <QuestionDetailsModal question={viewQuestion} onClose={() => setViewQuestion(null)} />
      )}

      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          setQuestion={setEditingQuestion}
          onCancel={() => setEditingQuestion(null)}
          onSave={saveEditQuestion}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "13px", marginTop: "3px" }}>{value || "N/A"}</div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ ...statCard, borderTop: `4px solid ${color}` }}>
      <div style={{ color: "#64748b", fontSize: "13px" }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: "bold", color }}>{value}</div>
    </div>
  );
}

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{ background: bg, color, padding: "5px 9px", borderRadius: "999px", fontWeight: 700, fontSize: "12px", whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

function QuestionDetailsModal({ question, onClose }: { question: Question; onClose: () => void }) {
  return (
    <div style={modalOverlay}>
      <div style={modal}>
        <h2 style={modalTitle}>Question Details</h2>
        <Detail label="Question" value={question.question_text} />
        <Detail label="Expected Answer" value={question.expected_answer || "Not available"} />
        <Detail label="Profile Type" value={question.profile_type} />
        <Detail label="Technology" value={question.technology} />
        <Detail label="Sub Technology" value={question.sub_technology} />
        <Detail label="Category" value={question.category} />
        <Detail label="Difficulty" value={question.difficulty} />
        <Detail label="Question Type" value={question.question_type} />
        <Detail label="Source Type" value={question.source_type} />
        <Detail label="Confidence Score" value={String(question.confidence_score ?? 0)} />

        <div style={{ marginTop: "20px", textAlign: "right" }}>
          <button onClick={onClose} style={primaryButton}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "bold" }}>{label}</div>
      <div style={{ marginTop: "4px", lineHeight: 1.5 }}>{value || "Not available"}</div>
    </div>
  );
}

function EditQuestionModal({
  question,
  setQuestion,
  onCancel,
  onSave,
}: {
  question: Question;
  setQuestion: (q: Question) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div style={modalOverlay}>
      <div style={modal}>
        <h2 style={modalTitle}>Edit Question</h2>

        <label style={label}>Question</label>
        <textarea
          value={question.question_text || ""}
          onChange={(e) => setQuestion({ ...question, question_text: e.target.value })}
          rows={4}
          style={{ ...input, width: "100%", marginBottom: "10px" }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <input placeholder="Profile Type" value={question.profile_type || ""} onChange={(e) => setQuestion({ ...question, profile_type: e.target.value })} style={input} />
          <input placeholder="Technology" value={question.technology || ""} onChange={(e) => setQuestion({ ...question, technology: e.target.value })} style={input} />
          <input placeholder="Sub Technology" value={question.sub_technology || ""} onChange={(e) => setQuestion({ ...question, sub_technology: e.target.value })} style={input} />
          <input placeholder="Category" value={question.category || ""} onChange={(e) => setQuestion({ ...question, category: e.target.value })} style={input} />
          <input placeholder="Sub Category" value={question.sub_category || ""} onChange={(e) => setQuestion({ ...question, sub_category: e.target.value })} style={input} />

          <select value={question.difficulty || ""} onChange={(e) => setQuestion({ ...question, difficulty: e.target.value })} style={input}>
            <option value="">Select Difficulty</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
            <option value="Expert">Expert</option>
          </select>

          <select value={question.question_type || ""} onChange={(e) => setQuestion({ ...question, question_type: e.target.value })} style={input}>
            <option value="">Select Type</option>
            <option value="Conceptual">Conceptual</option>
            <option value="Scenario">Scenario</option>
            <option value="Coding">Coding</option>
            <option value="Debugging">Debugging</option>
            <option value="Architecture">Architecture</option>
            <option value="Behavioral">Behavioral</option>
            <option value="Domain">Domain</option>
            <option value="SQL">SQL</option>
            <option value="Tool">Tool</option>
          </select>

          <input placeholder="Source Type" value={question.source_type || ""} onChange={(e) => setQuestion({ ...question, source_type: e.target.value })} style={input} />
          <input type="number" placeholder="Confidence Score" value={question.confidence_score || 0} onChange={(e) => setQuestion({ ...question, confidence_score: Number(e.target.value) })} style={input} />
        </div>

        <label style={{ ...label, marginTop: "12px" }}>Expected Answer</label>
        <textarea
          value={question.expected_answer || ""}
          onChange={(e) => setQuestion({ ...question, expected_answer: e.target.value })}
          rows={4}
          style={{ ...input, width: "100%" }}
        />

        <div style={{ marginTop: "20px", textAlign: "right" }}>
          <button onClick={onCancel} style={{ ...smallButton, background: "#64748b", marginRight: "10px" }}>
            Cancel
          </button>
          <button onClick={onSave} style={{ ...smallButton, background: "#15803d" }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = { padding: "36px", background: "#f8fafc", minHeight: "100vh" };
const hero: React.CSSProperties = { background: "linear-gradient(135deg,#1d4ed8,#7c3aed)", color: "#fff", padding: "28px", borderRadius: "16px", marginBottom: "22px" };
const title: React.CSSProperties = { fontSize: "32px", fontWeight: "bold", margin: 0 };
const subtitle: React.CSSProperties = { marginTop: "10px", maxWidth: "900px", lineHeight: 1.5 };
const statsGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "14px", marginBottom: "22px" };
const statCard: React.CSSProperties = { background: "#fff", padding: "18px", borderRadius: "14px", boxShadow: "0 8px 24px rgba(15,23,42,.08)" };
const card: React.CSSProperties = { background: "#fff", padding: "20px", borderRadius: "14px", boxShadow: "0 8px 24px rgba(15,23,42,.08)" };
const filterGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: "10px", marginBottom: "12px" };
const input: React.CSSProperties = { padding: "10px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px" };
const primaryButton: React.CSSProperties = { padding: "10px 16px", background: "#111827", color: "#fff", borderRadius: "8px", cursor: "pointer", border: "none", fontWeight: "bold" };
const smallButton: React.CSSProperties = { padding: "6px 10px", background: "#111827", color: "#fff", borderRadius: "6px", cursor: "pointer", border: "none", fontSize: "12px", whiteSpace: "nowrap" };
const actionButton: React.CSSProperties = { ...smallButton, padding: "6px 10px" };
const toolbar: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" };
const selectAllBox: React.CSSProperties = { display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px", fontWeight: "bold", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px" };
const errorBox: React.CSSProperties = { padding: "14px", background: "#fee2e2", color: "#991b1b", borderRadius: "10px", marginBottom: "12px" };
const questionCard: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "16px", boxShadow: "0 4px 14px rgba(15,23,42,.06)" };
const questionText: React.CSSProperties = { fontSize: "16px", fontWeight: 700, marginBottom: "12px", lineHeight: 1.45 };
const metaGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" };
const badgeRow: React.CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" };
const cardActions: React.CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #e5e7eb" };
const pagination: React.CSSProperties = { marginTop: "18px", display: "flex", justifyContent: "space-between", alignItems: "center" };
const modalOverlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 };
const modal: React.CSSProperties = { background: "#fff", padding: "24px", width: "780px", maxHeight: "90vh", overflowY: "auto", borderRadius: "14px", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" };
const modalTitle: React.CSSProperties = { fontSize: "22px", fontWeight: "bold", marginBottom: "15px" };
const label: React.CSSProperties = { display: "block", marginBottom: "6px", fontWeight: "bold" };
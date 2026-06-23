"use client";

import { useEffect, useState } from "react";

type ResumeAnalysis = {
  profileType: string;
  subProfile: string;
  interviewTrack: string;
  summary: string;
  seniority: string;
  experienceYears: number;
  handsOnSkills: string[];
  domainSkills: string[];
  technologyDomainsHandled: string[];
  consultantProfilesMarketed: string[];
  tools: string[];
  strengths: string[];
  weakAreas: string[];
  recommendedInterviewTopics: string[];
  questionCategories: string[];
};

type ConsultantRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  profile_type: string | null;
  seniority: string | null;
  experience_years: number | null;
  created_at: string | null;
};

export default function ConsultantsPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinProfile, setLinkedinProfile] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [error, setError] = useState("");

  const [consultants, setConsultants] = useState<ConsultantRow[]>([]);
  const [gridLoading, setGridLoading] = useState(false);

  const loadConsultants = async () => {
    setGridLoading(true);

    const res = await fetch("/api/consultants/list");
    const data = await res.json();

    if (res.ok) {
      setConsultants(data.consultants || []);
    }

    setGridLoading(false);
  };

  useEffect(() => {
    loadConsultants();
  }, []);

  const analyzeResume = async () => {
    setLoading(true);
    setAnalysis(null);
    setError("");

    const formData = new FormData();
    formData.append("full_name", fullName);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("linkedin_profile", linkedinProfile);
    formData.append("resume_text", resumeText);

    if (resumeFile) formData.append("resume_file", resumeFile);

    const res = await fetch("/api/analyze-resume", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    setAnalysis(data.resumeAnalysis);
    await loadConsultants();
  };

  const renderList = (items?: string[]) => {
    if (!items || items.length === 0) return <p style={muted}>Not available</p>;

    return (
      <div style={tagWrap}>
        {items.map((item, index) => (
          <span key={index} style={tag}>
            {item}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div style={page}>
      <div style={hero}>
        <div>
          <h1 style={title}>Consultant Resume Analyzer</h1>
          <p style={subtitle}>
            Upload a resume and let the Resume Intelligence Agent classify profile,
            skills, interview track, strengths, and validation areas.
          </p>
        </div>
      </div>

      <div style={card}>
        <div style={grid2}>
          <input
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={input}
          />
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
          <input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={input}
          />
          <input
            placeholder="LinkedIn Profile"
            value={linkedinProfile}
            onChange={(e) => setLinkedinProfile(e.target.value)}
            style={input}
          />
        </div>

        <div style={uploadBox}>
          <strong>Upload Resume PDF / DOCX / TXT</strong>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            style={{ marginTop: "12px" }}
          />
        </div>

        <textarea
          placeholder="Optional: Paste resume text here if no file is uploaded..."
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          rows={8}
          style={{ ...input, width: "100%", resize: "vertical" }}
        />

        <button onClick={analyzeResume} disabled={loading} style={primaryButton}>
          {loading ? "Analyzing Resume..." : "Analyze Resume"}
        </button>

        {error && <div style={errorBox}>{error}</div>}
      </div>

      <div style={gridCard}>
        <div style={gridHeader}>
          <div>
            <h2 style={{ margin: 0 }}>Uploaded Resumes</h2>
            <p style={muted}>
              Latest resume uploads and AI analysis status.
            </p>
          </div>

          <button onClick={loadConsultants} style={secondaryButton}>
            {gridLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Phone</th>
                <th style={th}>Profile</th>
                <th style={th}>Seniority</th>
                <th style={th}>Experience</th>
                <th style={th}>Status</th>
                <th style={th}>Uploaded</th>
              </tr>
            </thead>

            <tbody>
              {consultants.length === 0 && (
                <tr>
                  <td style={td} colSpan={8}>
                    No uploaded resumes found.
                  </td>
                </tr>
              )}

              {consultants.map((c) => {
                const analyzed = Boolean(c.profile_type);

                return (
                  <tr key={c.id}>
                    <td style={td}>{c.full_name || "N/A"}</td>
                    <td style={td}>{c.email || "N/A"}</td>
                    <td style={td}>{c.phone || "N/A"}</td>
                    <td style={td}>{c.profile_type || "N/A"}</td>
                    <td style={td}>{c.seniority || "N/A"}</td>
                    <td style={td}>
                      {c.experience_years !== null &&
                      c.experience_years !== undefined
                        ? c.experience_years
                        : "N/A"}
                    </td>
                    <td style={td}>
                      <span style={analyzed ? successBadge : pendingBadge}>
                        {analyzed ? "Analyzed" : "Pending"}
                      </span>
                    </td>
                    <td style={td}>
                      {c.created_at
                        ? new Date(c.created_at).toLocaleString()
                        : "N/A"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {analysis && (
        <div style={resultCard}>
          <h2 style={sectionTitle}>Resume Intelligence Result</h2>

          <div style={summaryGrid}>
            <Info label="Profile Type" value={analysis.profileType} color="#2563eb" />
            <Info label="Sub Profile" value={analysis.subProfile} color="#7c3aed" />
            <Info label="Interview Track" value={analysis.interviewTrack} color="#0891b2" />
            <Info label="Seniority" value={analysis.seniority} color="#15803d" />
            <Info label="Experience Years" value={String(analysis.experienceYears)} color="#b45309" />
          </div>

          <Block title="Summary">
            <p style={{ lineHeight: 1.6 }}>{analysis.summary}</p>
          </Block>

          <Block title="Hands-on Skills">{renderList(analysis.handsOnSkills)}</Block>
          <Block title="Domain Skills">{renderList(analysis.domainSkills)}</Block>
          <Block title="Technology Domains Handled">{renderList(analysis.technologyDomainsHandled)}</Block>
          <Block title="Consultant Profiles Marketed">{renderList(analysis.consultantProfilesMarketed)}</Block>
          <Block title="Tools">{renderList(analysis.tools)}</Block>
          <Block title="Strengths">{renderList(analysis.strengths)}</Block>
          <Block title="Weak Areas / Areas To Validate">{renderList(analysis.weakAreas)}</Block>
          <Block title="Recommended Interview Topics">{renderList(analysis.recommendedInterviewTopics)}</Block>
          <Block title="Question Categories">{renderList(analysis.questionCategories)}</Block>
        </div>
      )}
    </div>
  );
}

function Info({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ ...infoCard, borderTop: `4px solid ${color}` }}>
      <div style={infoLabel}>{label}</div>
      <div style={infoValue}>{value || "Not available"}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={block}>
      <h3 style={blockTitle}>{title}</h3>
      {children}
    </div>
  );
}

const page: React.CSSProperties = {
  padding: "36px",
  maxWidth: "1200px",
  margin: "0 auto",
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
  maxWidth: "780px",
  lineHeight: 1.5,
};

const card: React.CSSProperties = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  boxShadow: "0 8px 24px rgba(15,23,42,.08)",
  marginBottom: "24px",
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "14px",
  marginBottom: "16px",
};

const input: React.CSSProperties = {
  padding: "12px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "14px",
};

const uploadBox: React.CSSProperties = {
  padding: "18px",
  border: "1px dashed #94a3b8",
  borderRadius: "12px",
  background: "#f1f5f9",
  marginBottom: "16px",
};

const primaryButton: React.CSSProperties = {
  marginTop: "14px",
  padding: "12px 20px",
  background: "#111827",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
};

const secondaryButton: React.CSSProperties = {
  padding: "10px 14px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
};

const errorBox: React.CSSProperties = {
  marginTop: "18px",
  padding: "14px",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: "10px",
};

const resultCard: React.CSSProperties = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  boxShadow: "0 8px 24px rgba(15,23,42,.08)",
};

const gridCard: React.CSSProperties = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  boxShadow: "0 8px 24px rgba(15,23,42,.08)",
  marginBottom: "24px",
};

const gridHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
  marginBottom: "16px",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px",
  background: "#f1f5f9",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
};

const successBadge: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  padding: "5px 10px",
  borderRadius: "999px",
  fontWeight: "bold",
  fontSize: "12px",
};

const pendingBadge: React.CSSProperties = {
  background: "#fef3c7",
  color: "#92400e",
  padding: "5px 10px",
  borderRadius: "999px",
  fontWeight: "bold",
  fontSize: "12px",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  marginBottom: "18px",
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "12px",
  marginBottom: "20px",
};

const infoCard: React.CSSProperties = {
  background: "#f8fafc",
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
};

const infoLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#64748b",
  marginBottom: "6px",
};

const infoValue: React.CSSProperties = {
  fontWeight: "bold",
};

const block: React.CSSProperties = {
  marginTop: "18px",
  paddingTop: "14px",
  borderTop: "1px solid #e5e7eb",
};

const blockTitle: React.CSSProperties = {
  fontSize: "18px",
  marginBottom: "10px",
};

const tagWrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const tag: React.CSSProperties = {
  background: "#e0f2fe",
  color: "#075985",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: 600,
};

const muted: React.CSSProperties = {
  color: "#64748b",
};
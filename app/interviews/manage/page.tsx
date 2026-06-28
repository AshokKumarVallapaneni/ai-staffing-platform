"use client";

import { useEffect, useMemo, useState } from "react";

type Consultant = {
  id: string;
  full_name: string;
  email: string;
  profile_type: string;
  seniority: string;
  experience_years: number;
  hands_on_skills?: string[] | null;
  skills?: string[] | null;
  domain_skills?: string[] | null;
  technology_domains_handled?: string[] | null;
  tools?: string[] | null;
};

export default function InterviewManagePage() {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [consultantId, setConsultantId] = useState("");
  const [interviewMode, setInterviewMode] = useState("ONSITE");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(60);

  const [codingRequired, setCodingRequired] = useState(true);
  const [brokenCodeRequired, setBrokenCodeRequired] = useState(false);
  const [systemDesignRequired, setSystemDesignRequired] = useState(true);

  const [loading, setLoading] = useState(false);
  const [resultLink, setResultLink] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedConsultant = useMemo(
    () => consultants.find((c) => c.id === consultantId) || null,
    [consultants, consultantId]
  );

  const techStack = useMemo(() => {
    if (!selectedConsultant) return [];

    const values = [
      selectedConsultant.profile_type,
      ...(selectedConsultant.hands_on_skills || []),
      ...(selectedConsultant.skills || []),
      ...(selectedConsultant.domain_skills || []),
      ...(selectedConsultant.technology_domains_handled || []),
      ...(selectedConsultant.tools || []),
    ];

    return Array.from(
      new Set(
        values
          .filter(Boolean)
          .map((x) => String(x).trim())
          .filter((x) => x.length > 0)
      )
    );
  }, [selectedConsultant]);

  const loadConsultants = async () => {
    setError("");

    const res = await fetch("/api/interviews/orchestrate");
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to load consultants.");
      return;
    }

    setConsultants(data.consultants || []);
  };

  useEffect(() => {
    loadConsultants();
  }, []);

  const createInterview = async (startType: "SCHEDULED" | "ON_DEMAND") => {
    if (!consultantId) {
      setError("Please select a consultant.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setResultLink("");

    const res = await fetch("/api/interviews/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consultant_id: consultantId,
        interview_mode: interviewMode,
        start_type: startType,
        scheduled_at: startType === "SCHEDULED" ? scheduledAt : null,
        duration_minutes: duration,
        coding_required: codingRequired,
        broken_code_required: brokenCodeRequired,
        system_design_required: systemDesignRequired,
        consultant_tech_stack: techStack,
        send_email: startType === "SCHEDULED",
        started_by: "Admin",
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to create interview.");
      return;
    }

    setMessage(`${data.message}. Interview agent prepared questions based on consultant profile and tech stack.`);
    setResultLink(data.session.interview_link);

    if (startType === "ON_DEMAND") {
      window.open(data.session.interview_link, "_blank");
    }
  };

  return (
    <div style={page}>
      <div style={hero}>
        <h1 style={title}>Interview Orchestration</h1>
        <p>
          Schedule interviews, send invite links, or start AI interviews instantly
          for office walk-in consultants.
        </p>
      </div>

      <div style={card}>
        <label style={label}>Select Consultant</label>
        <select
          value={consultantId}
          onChange={(e) => setConsultantId(e.target.value)}
          style={input}
        >
          <option value="">Select consultant</option>
          {consultants.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name || "Unnamed"} - {c.profile_type || "No Profile"} - {c.email}
            </option>
          ))}
        </select>

        {selectedConsultant && (
          <div style={consultantBox}>
            <div style={consultantGrid}>
              <Info label="Name" value={selectedConsultant.full_name} />
              <Info label="Email" value={selectedConsultant.email} />
              <Info label="Profile" value={selectedConsultant.profile_type} />
              <Info label="Seniority" value={selectedConsultant.seniority} />
              <Info
                label="Experience"
                value={`${selectedConsultant.experience_years || 0} years`}
              />
            </div>

            <div style={{ marginTop: "14px" }}>
              <div style={label}>Tech Stack / Skills Detected</div>
              {techStack.length > 0 ? (
                <div style={tagWrap}>
                  {techStack.map((skill) => (
                    <span key={skill} style={tag}>
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={muted}>No skills found for this consultant.</p>
              )}
            </div>
          </div>
        )}

        <div style={grid}>
          <div>
            <label style={label}>Interview Mode</label>
            <select
              value={interviewMode}
              onChange={(e) => setInterviewMode(e.target.value)}
              style={input}
            >
              <option value="ONSITE">Onsite</option>
              <option value="REMOTE">Remote</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>

          <div>
            <label style={label}>Scheduled Date/Time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              style={input}
            />
          </div>

          <div>
            <label style={label}>Duration Minutes</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              style={input}
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
            </select>
          </div>
        </div>

        <div style={roundBox}>
          <label>
            <input
              type="checkbox"
              checked={codingRequired}
              onChange={(e) => setCodingRequired(e.target.checked)}
            />{" "}
            Coding Round
          </label>

          <label>
            <input
              type="checkbox"
              checked={brokenCodeRequired}
              onChange={(e) => setBrokenCodeRequired(e.target.checked)}
            />{" "}
            Broken Code Round
          </label>

          <label>
            <input
              type="checkbox"
              checked={systemDesignRequired}
              onChange={(e) => setSystemDesignRequired(e.target.checked)}
            />{" "}
            System Design Round
          </label>
        </div>

        <div style={actions}>
          <button
            onClick={() => createInterview("ON_DEMAND")}
            disabled={loading}
            style={{ ...button, background: "#15803d" }}
          >
            {loading ? "Preparing..." : "Start AI Interview Now"}
          </button>

          <button
            onClick={() => createInterview("SCHEDULED")}
            disabled={loading}
            style={{ ...button, background: "#2563eb" }}
          >
            {loading ? "Preparing..." : "Schedule & Send Invite"}
          </button>
        </div>

        {error && <div style={errorBox}>{error}</div>}
        {message && <div style={successBox}>{message}</div>}

        {resultLink && (
          <div style={linkBox}>
            <strong>Interview Link:</strong>
            <p>{resultLink}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
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
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "11px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  marginBottom: "16px",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "16px",
};

const consultantBox: React.CSSProperties = {
  padding: "16px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  marginBottom: "18px",
};

const consultantGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "12px",
};

const infoLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#64748b",
  fontWeight: "bold",
};

const infoValue: React.CSSProperties = {
  marginTop: "4px",
  fontWeight: "bold",
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
  fontWeight: 700,
};

const muted: React.CSSProperties = {
  color: "#64748b",
};

const roundBox: React.CSSProperties = {
  display: "flex",
  gap: "20px",
  padding: "16px",
  background: "#f1f5f9",
  borderRadius: "10px",
  marginTop: "10px",
};

const actions: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  marginTop: "22px",
};

const button: React.CSSProperties = {
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

const successBox: React.CSSProperties = {
  marginTop: "16px",
  padding: "14px",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: "10px",
};

const linkBox: React.CSSProperties = {
  marginTop: "16px",
  padding: "14px",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: "10px",
};
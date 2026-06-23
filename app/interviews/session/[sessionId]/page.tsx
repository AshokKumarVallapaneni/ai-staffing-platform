"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type InterviewQuestion = {
  id: string;
  question: string;
  answer_text: string | null;
  question_source: string;
};

export default function InterviewSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [candidateName, setCandidateName] = useState("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerText, setAnswerText] = useState("");
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const loadSession = async () => {
    const res = await fetch(`/api/interviews/session/${sessionId}`);
    const data = await res.json();

    if (res.ok) {
      setCandidateName(data.session?.consultants?.full_name || "Candidate");
      setQuestions(data.questions || []);
      setAnswerText(data.questions?.[0]?.answer_text || "");
    }

    setLoading(false);
  };

  useEffect(() => {
    loadSession();
  }, []);

  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    if (!started) return;

    const questionToSpeak = showFollowUp
      ? followUpQuestion
      : currentQuestion?.question;

    if (!questionToSpeak) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(questionToSpeak);
    speech.rate = 1;
    speech.pitch = 1;

    window.speechSynthesis.speak(speech);
  }, [currentQuestion, started, showFollowUp, followUpQuestion]);

  const startVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech Recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;

      setAnswerText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const goToCodingRound = () => {
    router.push(`/interviews/coding/${sessionId}`);
  };

  const saveAnswer = async () => {
    if (!currentQuestion) return;

    setSaving(true);

    try {
      const saveResponse = await fetch("/api/interviews/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answer_id: currentQuestion.id,
          answer_text: answerText,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error("Failed to save answer");
      }

      const followupResponse = await fetch("/api/interviews/followup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          answerId: currentQuestion.id,
          question: showFollowUp ? followUpQuestion : currentQuestion.question,
          answer: answerText,
        }),
      });

      const aiResult = await followupResponse.json();

      if (
        aiResult.decision === "FOLLOW_UP" &&
        aiResult.followUpQuestion &&
        !showFollowUp
      ) {
        setFollowUpQuestion(aiResult.followUpQuestion);
        setShowFollowUp(true);
        setAnswerText("");

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(
          new SpeechSynthesisUtterance(aiResult.followUpQuestion)
        );

        return;
      }

      if (aiResult.decision === "START_CODING_ROUND") {
        router.push(`/interviews/coding/${sessionId}`);
        return;
      }

      if (aiResult.decision === "END_INTERVIEW") {
        setCompleted(true);
        return;
      }

      setShowFollowUp(false);
      setFollowUpQuestion("");

      const updated = [...questions];
      updated[currentIndex] = {
        ...updated[currentIndex],
        answer_text: answerText,
      };

      setQuestions(updated);

      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(currentIndex + 1);
        setAnswerText("");
      } else {
        setCompleted(true);
      }
    } catch (error) {
      console.error("Save Answer Error:", error);
      alert("Failed to process answer.");
    } finally {
      setSaving(false);
    }
  };

  const finishInterview = async () => {
    const res = await fetch("/api/interviews/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
      }),
    });

    if (!res.ok) {
      alert("Failed to finish interview.");
      return;
    }

    alert("Interview completed successfully. Thank you!");
  };

  if (loading) {
    return <div style={page}>Loading interview...</div>;
  }

  if (!started) {
    return (
      <div style={page}>
        <div style={card}>
          <Avatar />
          <h1>Welcome, {candidateName}</h1>
          <p>
            I am your AI Interviewer. I will ask you questions one by one. Please
            answer clearly. At the end, you can review your questions and answers.
          </p>

          <button onClick={() => setStarted(true)} style={primaryButton}>
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div style={page}>
        <div style={headerCard}>
          <Avatar />
          <div>
            <h1>Interview Review</h1>
            <p>
              Thank you, {candidateName}. Below are the questions asked and your
              submitted answers.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gap: "16px" }}>
          {questions.map((q, index) => (
            <div key={q.id} style={reviewCard}>
              <div style={questionNumber}>Question {index + 1}</div>
              <h3>{q.question}</h3>
              <p style={sourceBadge}>{q.question_source}</p>

              <div style={answerBox}>
                <strong>Your Answer:</strong>
                <p>{q.answer_text || "No answer provided."}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <button onClick={finishInterview} style={primaryButton}>
            Finish Interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={interviewLayout}>
        <div style={avatarPanel}>
          <Avatar />
          <h2>AI Interviewer</h2>
          <p>
            Question {currentIndex + 1} of {questions.length}
          </p>

          <button
            onClick={goToCodingRound}
            style={{
              ...primaryButton,
              background: "#0f766e",
              marginTop: "30px",
            }}
          >
            Start Coding Round
          </button>
        </div>

        <div style={questionPanel}>
          <div style={progressBar}>
            <div
              style={{
                ...progressFill,
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>

          <p style={sourceBadge}>
            {showFollowUp ? "FOLLOW_UP" : currentQuestion?.question_source}
          </p>

          <h1 style={{ marginTop: "14px" }}>
            {showFollowUp ? followUpQuestion : currentQuestion?.question}
          </h1>

          <button
            onClick={startVoiceInput}
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "none",
              background: isListening ? "#ef4444" : "#0ea5e9",
              color: "#fff",
              cursor: "pointer",
              marginBottom: "12px",
            }}
          >
            {isListening ? "🎙 Listening..." : "🎤 Speak Answer"}
          </button>

          <textarea
            placeholder="Type your answer here..."
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            rows={10}
            style={textarea}
          />

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button onClick={saveAnswer} disabled={saving} style={primaryButton}>
              {saving
                ? "AI Evaluating..."
                : showFollowUp
                ? "Submit Follow-Up"
                : currentIndex + 1 === questions.length
                ? "Submit Final Answer"
                : "Submit Answer"}
            </button>

            <button
              onClick={goToCodingRound}
              style={{ ...primaryButton, background: "#0f766e" }}
            >
              Start Coding Round
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div style={avatarCircle}>
      <div style={avatarFace}>🤖</div>
      <div style={pulseRing}></div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "36px",
  background: "linear-gradient(135deg,#eef2ff,#f8fafc)",
};

const card: React.CSSProperties = {
  maxWidth: "700px",
  margin: "80px auto",
  background: "#fff",
  padding: "36px",
  borderRadius: "18px",
  textAlign: "center",
  boxShadow: "0 10px 30px rgba(15,23,42,.12)",
};

const interviewLayout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "360px 1fr",
  gap: "24px",
  maxWidth: "1300px",
  margin: "0 auto",
};

const avatarPanel: React.CSSProperties = {
  background: "#111827",
  color: "#fff",
  borderRadius: "18px",
  padding: "28px",
  textAlign: "center",
  minHeight: "500px",
};

const questionPanel: React.CSSProperties = {
  background: "#fff",
  borderRadius: "18px",
  padding: "28px",
  boxShadow: "0 10px 30px rgba(15,23,42,.10)",
};

const avatarCircle: React.CSSProperties = {
  width: "150px",
  height: "150px",
  borderRadius: "50%",
  background: "linear-gradient(135deg,#2563eb,#7c3aed)",
  margin: "0 auto 24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
};

const avatarFace: React.CSSProperties = {
  fontSize: "64px",
  zIndex: 2,
};

const pulseRing: React.CSSProperties = {
  position: "absolute",
  width: "170px",
  height: "170px",
  borderRadius: "50%",
  border: "3px solid rgba(255,255,255,.35)",
};

const textarea: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  marginTop: "20px",
  fontSize: "15px",
  resize: "vertical",
};

const primaryButton: React.CSSProperties = {
  marginTop: "20px",
  padding: "12px 20px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "bold",
};

const progressBar: React.CSSProperties = {
  width: "100%",
  height: "10px",
  background: "#e5e7eb",
  borderRadius: "999px",
  overflow: "hidden",
};

const progressFill: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg,#2563eb,#7c3aed)",
};

const sourceBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#e0f2fe",
  color: "#075985",
  padding: "5px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "bold",
};

const headerCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "24px",
  background: "#fff",
  padding: "24px",
  borderRadius: "18px",
  marginBottom: "24px",
  boxShadow: "0 10px 30px rgba(15,23,42,.10)",
};

const reviewCard: React.CSSProperties = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  boxShadow: "0 6px 18px rgba(15,23,42,.08)",
};

const questionNumber: React.CSSProperties = {
  color: "#2563eb",
  fontWeight: "bold",
  marginBottom: "8px",
};

const answerBox: React.CSSProperties = {
  marginTop: "14px",
  padding: "14px",
  background: "#f8fafc",
  borderRadius: "10px",
};
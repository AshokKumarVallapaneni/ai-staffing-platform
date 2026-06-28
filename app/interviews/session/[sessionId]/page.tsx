"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type InterviewQuestion = {
  id: string;
  question_id?: string | null;
  question: string;
  answer_text: string | null;
  question_source: string;
  topic?: string | null;
  difficulty?: string | null;
  question_type?: string | null;
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
  const [finished, setFinished] = useState(false);
  const [codingRequired, setCodingRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");

  const loadSession = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/interviews/session/${sessionId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load interview.");
      }

      const loadedQuestions: InterviewQuestion[] = data.questions || [];
      const firstUnansweredIndex = loadedQuestions.findIndex(
        (question) => !question.answer_text
      );
      const hasAnsweredQuestions = loadedQuestions.some(
        (question) => Boolean(question.answer_text)
      );

      setCandidateName(
        data.session?.consultants?.full_name || "Candidate"
      );
      setCodingRequired(Boolean(data.session?.coding_required));
      setQuestions(loadedQuestions);

      if (data.session?.status === "Completed") {
        setCompleted(true);
      } else if (
        loadedQuestions.length > 0 &&
        firstUnansweredIndex === -1
      ) {
        setCompleted(true);
      } else {
        const resolvedIndex =
          firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0;

        setCurrentIndex(resolvedIndex);
        setAnswerText(
          loadedQuestions[resolvedIndex]?.answer_text || ""
        );
      }

      if (
        hasAnsweredQuestions ||
        data.session?.status === "In Progress"
      ) {
        setStarted(true);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load interview."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    if (!started || completed || !currentQuestion?.question) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(
      currentQuestion.question
    );

    speech.rate = 1;
    speech.pitch = 1;

    window.speechSynthesis.speak(speech);
  }, [currentQuestion?.id, started, completed]);

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

      setAnswerText((previous) =>
        previous ? `${previous} ${transcript}` : transcript
      );
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const saveAnswer = async () => {
    if (!currentQuestion || saving) return;

    const cleanedAnswer = answerText.trim();

    if (!cleanedAnswer) {
      alert("Please provide an answer before continuing.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        "/api/interviews/next-question",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            answerId: currentQuestion.id,
            answerText: cleanedAnswer,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            (typeof data.details === "string"
              ? data.details
              : "Failed to process the answer.")
        );
      }

      const updatedQuestions = [...questions];

      updatedQuestions[currentIndex] = {
        ...updatedQuestions[currentIndex],
        answer_text: cleanedAnswer,
      };

      if (data.decision === "START_CODING_ROUND") {
        setQuestions(updatedQuestions);
        window.speechSynthesis.cancel();

        router.push(
          data.codingUrl ||
            `/interviews/coding/${sessionId}`
        );

        return;
      }

      if (data.decision === "END_INTERVIEW") {
        setQuestions(updatedQuestions);
        window.speechSynthesis.cancel();
        setCompleted(true);
        return;
      }

      if (data.nextQuestion) {
        const nextQuestion =
          data.nextQuestion as InterviewQuestion;

        let nextIndex = updatedQuestions.findIndex(
          (question) => question.id === nextQuestion.id
        );

        if (nextIndex < 0) {
          nextIndex = updatedQuestions.length;
          updatedQuestions.push(nextQuestion);
        }

        setQuestions(updatedQuestions);
        setCurrentIndex(nextIndex);
        setAnswerText("");

        window.speechSynthesis.cancel();

        const speech = new SpeechSynthesisUtterance(
          nextQuestion.question
        );

        speech.rate = 1;
        speech.pitch = 1;

        window.speechSynthesis.speak(speech);
      }
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to process the answer.";

      setError(message);
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const finishInterview = async () => {
    setFinishing(true);
    setError("");

    try {
      const res = await fetch("/api/interviews/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Failed to finish interview."
        );
      }

      setFinished(true);
    } catch (finishError) {
      setError(
        finishError instanceof Error
          ? finishError.message
          : "Failed to finish interview."
      );
    } finally {
      setFinishing(false);
    }
  };

  if (loading) {
    return <div style={page}>Loading interview...</div>;
  }

  if (error && questions.length === 0) {
    return (
      <div style={page}>
        <div style={card}>
          <h1>Unable to Load Interview</h1>
          <p style={{ color: "#991b1b" }}>{error}</p>
          <button onClick={loadSession} style={primaryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div style={page}>
        <div style={card}>
          <Avatar />
          <h1>Interview Submitted</h1>
          <p>
            Thank you, {candidateName}. Your interview and coding
            results have been submitted for review.
          </p>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div style={page}>
        <div style={card}>
          <Avatar />
          <h1>Welcome, {candidateName}</h1>
          <p>
            I am your AI interviewer. The interview is adaptive and
            will focus on the skills identified in your resume.
          </p>

          <button
            onClick={() => setStarted(true)}
            style={primaryButton}
          >
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
              Thank you, {candidateName}. Review the questions and
              your submitted answers below.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gap: "16px" }}>
          {questions
            .filter((question) => Boolean(question.answer_text))
            .map((question, index) => (
              <div key={question.id} style={reviewCard}>
                <div style={questionNumber}>
                  Interview Question {index + 1}
                </div>

                {question.topic && (
                  <span style={reviewTopicBadge}>
                    {question.topic}
                  </span>
                )}

                <h3>{question.question}</h3>

                <p style={sourceBadge}>
                  {formatSource(question.question_source)}
                </p>

                <div style={answerBox}>
                  <strong>Your Answer:</strong>
                  <p>
                    {question.answer_text ||
                      "No answer provided."}
                  </p>
                </div>
              </div>
            ))}
        </div>

        <div style={reviewActions}>
          {codingRequired && (
            <button
              onClick={() =>
                router.push(
                  `/interviews/coding/${sessionId}`
                )
              }
              style={{
                ...primaryButton,
                background: "#0f766e",
              }}
            >
              Open Coding Round
            </button>
          )}

          <button
            onClick={finishInterview}
            disabled={finishing}
            style={primaryButton}
          >
            {finishing
              ? "Submitting Interview..."
              : "Finish Interview"}
          </button>
        </div>

        {error && <div style={errorBox}>{error}</div>}
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div style={page}>
        <div style={card}>
          <h1>No Interview Question Available</h1>
          <p>
            The interview could not load the next question. Please
            contact the administrator.
          </p>
        </div>
      </div>
    );
  }

  const answeredCount = questions.filter(
    (question) => Boolean(question.answer_text)
  ).length;

  const softProgress = Math.min(
    92,
    12 + answeredCount * 3
  );

  return (
    <div style={page}>
      <div style={interviewLayout}>
        <div style={avatarPanel}>
          <Avatar />
          <h2>AI Interviewer</h2>
          <p>Technical Interview in Progress</p>

          {currentQuestion.topic && (
            <div style={skillBadge}>
              Current Focus: {currentQuestion.topic}
            </div>
          )}

          {currentQuestion.difficulty && (
            <div style={difficultyBadge}>
              Difficulty: {currentQuestion.difficulty}
            </div>
          )}
        </div>

        <div style={questionPanel}>
          <div style={progressBar}>
            <div
              style={{
                ...progressFill,
                width: `${softProgress}%`,
              }}
            />
          </div>

          <div style={questionMeta}>
            <span style={sourceBadge}>
              {formatSource(
                currentQuestion.question_source
              )}
            </span>

            {currentQuestion.question_type && (
              <span style={typeBadge}>
                {currentQuestion.question_type}
              </span>
            )}
          </div>

          <h1 style={{ marginTop: "14px" }}>
            {currentQuestion.question}
          </h1>

          <button
            onClick={startVoiceInput}
            disabled={saving}
            style={{
              ...voiceButton,
              background: isListening
                ? "#ef4444"
                : "#0ea5e9",
            }}
          >
            {isListening
              ? "🎙 Listening..."
              : "🎤 Speak Answer"}
          </button>

          <textarea
            placeholder="Type your answer here..."
            value={answerText}
            onChange={(event) =>
              setAnswerText(event.target.value)
            }
            rows={10}
            disabled={saving}
            style={textarea}
          />

          <button
            onClick={saveAnswer}
            disabled={saving}
            style={{
              ...primaryButton,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving
              ? "AI Evaluating and Preparing Next Question..."
              : "Submit Answer"}
          </button>

          {error && <div style={errorBox}>{error}</div>}
        </div>
      </div>
    </div>
  );
}

function formatSource(source?: string | null) {
  if (source === "QUESTION_BANK") {
    return "Real Interview Question";
  }

  if (source === "AI_GENERATED") {
    return "Adaptive AI Question";
  }

  if (source === "SYSTEM_GENERATED") {
    return "Adaptive Interview Question";
  }

  return source || "Interview Question";
}

function Avatar() {
  return (
    <div style={avatarCircle}>
      <div style={avatarFace}>🤖</div>
      <div style={pulseRing} />
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "36px",
  background:
    "linear-gradient(135deg,#eef2ff,#f8fafc)",
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
  gridTemplateColumns: "360px minmax(0, 1fr)",
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
  minWidth: 0,
  background: "#fff",
  borderRadius: "18px",
  padding: "28px",
  boxShadow: "0 10px 30px rgba(15,23,42,.10)",
};

const avatarCircle: React.CSSProperties = {
  width: "150px",
  height: "150px",
  borderRadius: "50%",
  background:
    "linear-gradient(135deg,#2563eb,#7c3aed)",
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
  boxSizing: "border-box",
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

const voiceButton: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "8px",
  border: "none",
  color: "#fff",
  cursor: "pointer",
  marginTop: "16px",
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
  background:
    "linear-gradient(90deg,#2563eb,#7c3aed)",
  transition: "width .35s ease",
};

const questionMeta: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "18px",
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

const typeBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#ede9fe",
  color: "#6d28d9",
  padding: "5px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "bold",
};

const skillBadge: React.CSSProperties = {
  display: "inline-block",
  marginTop: "12px",
  padding: "7px 11px",
  background: "rgba(255,255,255,.12)",
  color: "#fff",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: "bold",
};

const difficultyBadge: React.CSSProperties = {
  display: "block",
  width: "fit-content",
  margin: "10px auto 0",
  padding: "7px 11px",
  background: "rgba(255,255,255,.08)",
  color: "#e2e8f0",
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

const reviewTopicBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#ede9fe",
  color: "#6d28d9",
  borderRadius: "999px",
  padding: "5px 10px",
  fontSize: "12px",
  fontWeight: "bold",
};

const answerBox: React.CSSProperties = {
  marginTop: "14px",
  padding: "14px",
  background: "#f8fafc",
  borderRadius: "10px",
};

const reviewActions: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "24px",
};

const errorBox: React.CSSProperties = {
  marginTop: "16px",
  padding: "14px",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: "10px",
};

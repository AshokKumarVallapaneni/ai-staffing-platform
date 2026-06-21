import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const { data: session, error: sessionError } = await supabase
    .from("interview_sessions")
    .select(`
      *,
      consultants (
        id,
        full_name,
        email,
        profile_type,
        seniority,
        experience_years
      )
    `)
    .eq("id", sessionId)
    .single();

  if (sessionError) {
    return NextResponse.json(
      {
        error: "Interview session not found",
        details: sessionError,
      },
      { status: 404 }
    );
  }

  const { data: answers, error: answersError } = await supabase
    .from("interview_answers")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (answersError) {
    return NextResponse.json(
      {
        error: "Failed to load interview questions",
        details: answersError,
      },
      { status: 500 }
    );
  }

  const { data: transcript } = await supabase
    .from("interview_transcript")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const { data: codingAnswers } = await supabase
    .from("interview_coding_answers")
    .select("*")
    .eq("session_id", sessionId);

  const answeredQuestions =
    answers?.filter(a => a.answer_text)?.length || 0;

  const totalQuestions =
    answers?.length || 0;

  return NextResponse.json({
    session,

    questions: answers || [],

    transcript: transcript || [],

    codingAnswers: codingAnswers || [],

    statistics: {
      totalQuestions,
      answeredQuestions,
      remainingQuestions:
        totalQuestions - answeredQuestions,

      completionPercentage:
        totalQuestions === 0
          ? 0
          : Math.round(
              (answeredQuestions /
                totalQuestions) *
                100
            ),
    },
  });
}
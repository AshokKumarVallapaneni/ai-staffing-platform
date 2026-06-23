import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await supabase
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
      ),
      interview_answers (
        id,
        question,
        answer_text,
        feedback,
        score,
        technical_score,
        communication_score,
        confidence_score,
        question_source,
        created_at
      ),
      interview_coding_answers (
        id,
        language,
        question,
        source_code,
        execution_result,
        score,
        feedback,
        created_at
      )
    `)
    .eq("status", "Completed")
    .order("completed_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load interview results", details: error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    results: data || [],
  });
}
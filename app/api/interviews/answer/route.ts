import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { answer_id, answer_text } = await req.json();

    if (!answer_id) {
      return NextResponse.json(
        { error: "answer_id is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("interview_answers")
      .update({
        answer_text,
      })
      .eq("id", answer_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to save answer", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ answer: data });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}
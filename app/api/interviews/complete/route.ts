import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("interview_sessions")
      .update({
        status: "Completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to complete interview", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Interview completed successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}
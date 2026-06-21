import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const search = searchParams.get("search") || "";
  const profileType = searchParams.get("profile_type") || "";
  const technology = searchParams.get("technology") || "";
  const difficulty = searchParams.get("difficulty") || "";
  const reviewStatus = searchParams.get("review_status") || "";
  const lowConfidence = searchParams.get("lowConfidence") || "";

  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("pageSize") || "25");

  let query = supabase
    .from("question_bank")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) query = query.ilike("question_text", `%${search}%`);
  if (profileType) query = query.eq("profile_type", profileType);
  if (technology) query = query.eq("technology", technology);
  if (difficulty) query = query.eq("difficulty", difficulty);
  if (reviewStatus) query = query.eq("review_status", reviewStatus);
  if (lowConfidence === "true") query = query.lt("confidence_score", 70);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load questions", details: error },
      { status: 500 }
    );
  }

  const [total, approved, pending, rejected, low] = await Promise.all([
    supabase.from("question_bank").select("id", { count: "exact", head: true }),
    supabase.from("question_bank").select("id", { count: "exact", head: true }).eq("review_status", "Approved"),
    supabase.from("question_bank").select("id", { count: "exact", head: true }).eq("review_status", "Pending"),
    supabase.from("question_bank").select("id", { count: "exact", head: true }).eq("review_status", "Rejected"),
    supabase.from("question_bank").select("id", { count: "exact", head: true }).lt("confidence_score", 70),
  ]);

  return NextResponse.json({
    questions: data || [],
    totalCount: count || 0,
    stats: {
      total: total.count || 0,
      approved: approved.count || 0,
      pending: pending.count || 0,
      rejected: rejected.count || 0,
      lowConfidence: low.count || 0,
    },
  });
}

export async function PATCH(req: Request) {
  const body = await req.json();

  const {
    id,
    ids,
    is_active,
    review_status,
    question_text,
    profile_type,
    technology,
    sub_technology,
    category,
    sub_category,
    difficulty,
    question_type,
    source_type,
    expected_answer,
    confidence_score,
  } = body;

  const updateData: Record<string, unknown> = {};

  if (typeof is_active === "boolean") updateData.is_active = is_active;
  if (review_status !== undefined) updateData.review_status = review_status;

  if (question_text !== undefined) updateData.question_text = question_text;
  if (profile_type !== undefined) updateData.profile_type = profile_type;
  if (technology !== undefined) updateData.technology = technology;
  if (sub_technology !== undefined) updateData.sub_technology = sub_technology;
  if (category !== undefined) updateData.category = category;
  if (sub_category !== undefined) updateData.sub_category = sub_category;
  if (difficulty !== undefined) updateData.difficulty = difficulty;
  if (question_type !== undefined) updateData.question_type = question_type;
  if (source_type !== undefined) updateData.source_type = source_type;
  if (expected_answer !== undefined) updateData.expected_answer = expected_answer;
  if (confidence_score !== undefined) updateData.confidence_score = Number(confidence_score);

  if (ids && Array.isArray(ids) && ids.length > 0) {
    const { data, error } = await supabase
      .from("question_bank")
      .update(updateData)
      .in("id", ids)
      .select();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update selected questions", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ questions: data });
  }

  if (!id) {
    return NextResponse.json({ error: "Question id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("question_bank")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update question", details: error },
      { status: 500 }
    );
  }

  return NextResponse.json({ question: data });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Question id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("question_bank").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete question", details: error },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Question deleted successfully" });
}
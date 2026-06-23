import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await supabase
    .from("consultants")
    .select(
      "id, full_name, email, phone, profile_type, seniority, experience_years, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load consultants", details: error },
      { status: 500 }
    );
  }

  return NextResponse.json({ consultants: data || [] });
}
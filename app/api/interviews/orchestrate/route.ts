import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";
import crypto from "crypto";

export const runtime = "nodejs";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

type GeneratedQuestion = {
  question_text: string;
  question_type: string;
  difficulty: string;
  expected_answer?: string;
};

function getQuestionCountByDuration(minutes: number) {
  if (minutes <= 30) return 6;
  if (minutes <= 45) return 8;
  if (minutes <= 60) return 10;
  return 15;
}

async function getQuestionBankQuestions(profileType: string, count: number) {
  let query = supabase
    .from("question_bank")
    .select("*")
    .eq("is_active", true)
    .eq("review_status", "Approved")
    .limit(count);

  if (profileType) {
    query = query.eq("profile_type", profileType);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}

async function generateAIQuestions(
  consultant: Record<string, any>,
  count: number,
  rounds: {
    coding_required: boolean;
    broken_code_required: boolean;
    system_design_required: boolean;
  }
): Promise<GeneratedQuestion[]> {
  if (count <= 0) return [];

  if (!process.env.OPENAI_API_KEY) {
    return [];
  }

  const prompt = `
You are an AI Interview Orchestration Agent.

Generate ${count} interview questions for the consultant below.

The questions should be specific to the consultant profile, skills, seniority, and experience.
Do not duplicate common/basic questions if the person is senior.
Do not return markdown.
Return ONLY valid JSON array.

Consultant:
{
  "full_name": "${consultant.full_name || ""}",
  "profile_type": "${consultant.profile_type || ""}",
  "seniority": "${consultant.seniority || ""}",
  "experience_years": "${consultant.experience_years || ""}",
  "hands_on_skills": ${JSON.stringify(consultant.hands_on_skills || consultant.skills || [])},
  "domain_skills": ${JSON.stringify(consultant.domain_skills || [])},
  "technology_domains_handled": ${JSON.stringify(consultant.technology_domains_handled || [])},
  "tools": ${JSON.stringify(consultant.tools || [])}
}

Rounds:
{
  "coding_required": ${rounds.coding_required},
  "broken_code_required": ${rounds.broken_code_required},
  "system_design_required": ${rounds.system_design_required}
}

Rules:
- Mix conceptual, scenario-based, architecture, debugging, and practical questions.
- If coding_required is true, include at least one coding-style question.
- If broken_code_required is true, include at least one debugging/broken-code question.
- If system_design_required is true, include at least one system design question.
- For Bench Sales Recruiter or IT Recruiter, do not generate coding questions.
- For QA/SDET, focus on test automation, API testing, debugging, framework design.
- For Data Engineer, focus on SQL, pipelines, Spark, Airflow, Kafka, Snowflake/Databricks if relevant.
- For .NET/Java/Python developers, focus on backend, APIs, design, performance, database, cloud, and debugging.

Return exact JSON array:
[
  {
    "question_text": "",
    "question_type": "Conceptual | Scenario | Coding | Debugging | Architecture | Behavioral | Domain | SQL | Tool",
    "difficulty": "Easy | Medium | Hard | Expert",
    "expected_answer": ""
  }
]
`;

  const aiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: prompt,
    }),
  });

  const data = await aiResponse.json();

  if (!aiResponse.ok) {
    console.error("AI question generation failed:", data);
    return [];
  }

  const outputText =
    data.output_text ||
    data.output?.[0]?.content?.find(
      (c: { type: string; text?: string }) => c.type === "output_text"
    )?.text;

  if (!outputText) return [];

  try {
    return JSON.parse(outputText);
  } catch (error) {
    console.error("AI generated invalid JSON:", outputText);
    return [];
  }
}

export async function GET() {
  const { data, error } = await supabase
    .from("consultants")
    .select(
      "id, full_name, email, profile_type, seniority, experience_years, hands_on_skills, skills, domain_skills, technology_domains_handled, tools"
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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      consultant_id,
      interview_mode,
      start_type,
      scheduled_at,
      duration_minutes,
      coding_required,
      broken_code_required,
      system_design_required,
      send_email,
      started_by,
    } = body;

    if (!consultant_id) {
      return NextResponse.json(
        { error: "Consultant is required" },
        { status: 400 }
      );
    }

    const duration = Number(duration_minutes || 60);
   /*
  Initial seed questions only.
  AI interviewer will generate unlimited follow-ups later.
*/

const questionBankCount = 15;
const aiGeneratedCount = 15;

    const { data: consultant, error: consultantError } = await supabase
      .from("consultants")
      .select("*")
      .eq("id", consultant_id)
      .single();

    if (consultantError || !consultant) {
      return NextResponse.json(
        { error: "Consultant not found", details: consultantError },
        { status: 404 }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 7);

    const { data: session, error: sessionError } = await supabase
      .from("interview_sessions")
      .insert({
        consultant_id,
        domain: consultant.profile_type,
        technology: consultant.profile_type,
        experience: consultant.experience_years
          ? String(consultant.experience_years)
          : null,
        mode: start_type,
        interview_mode: interview_mode || "ONSITE",
        start_type: start_type || "ON_DEMAND",
        started_by: started_by || "Admin",
        duration_minutes: duration,
        question_count: 10,
        coding_required: coding_required || false,
        broken_code_required: broken_code_required || false,
        system_design_required: system_design_required || false,
        scheduled_at: scheduled_at || null,
        invite_token: token,
        invite_expires_at: inviteExpiresAt.toISOString(),
        interview_link: "",
        email_status: "Not Sent",
        status: start_type === "ON_DEMAND" ? "Ready" : "Scheduled",
      })
      .select()
      .single();

    if (sessionError) {
      return NextResponse.json(
        { error: "Failed to create interview session", details: sessionError },
        { status: 500 }
      );
    }
    await supabase
  .from("interview_transcript")
  .insert({
    session_id: session.id,
    speaker: "AI",
    message:
      "Welcome to your AI interview. Let's begin.",
  });

    const finalInterviewLink =
      start_type === "ON_DEMAND"
        ? `${baseUrl}/interviews/session/${session.id}`
        : `${baseUrl}/interviews/start/${token}`;

    await supabase
      .from("interview_sessions")
      .update({ interview_link: finalInterviewLink })
      .eq("id", session.id);

    const questionBankQuestions = await getQuestionBankQuestions(
      consultant.profile_type,
      questionBankCount
    );

    const aiQuestions = await generateAIQuestions(consultant, aiGeneratedCount, {
      coding_required: Boolean(coding_required),
      broken_code_required: Boolean(broken_code_required),
      system_design_required: Boolean(system_design_required),
    });

    const answerRows = [
      ...questionBankQuestions.map((q) => ({
        session_id: session.id,
        question_id: q.id,
        question: q.question_text,
        answer_text: null,
        score: null,
        feedback: null,
        question_source: "QUESTION_BANK",
      })),

      ...aiQuestions.map((q) => ({
        session_id: session.id,
        question_id: null,
        question: q.question_text,
        answer_text: null,
        score: null,
        feedback: q.expected_answer || null,
        question_source: "AI_GENERATED",
      })),
    ];

    if (answerRows.length > 0) {
      const { error: answerError } = await supabase
        .from("interview_answers")
        .insert(answerRows);

      if (answerError) {
        return NextResponse.json(
          { error: "Failed to create interview questions", details: answerError },
          { status: 500 }
        );
      }
    }

    let emailStatus = "Not Sent";

    if (send_email && consultant.email && resend) {
      await resend.emails.send({
        from: "AI Staffing Platform <onboarding@resend.dev>",
        to: consultant.email,
        subject: "Your AI Interview Invitation",
        html: `
          <h2>AI Interview Invitation</h2>
          <p>Hello ${consultant.full_name || "Candidate"},</p>
          <p>You are invited to complete your AI interview.</p>
          <p><strong>Interview Link:</strong></p>
          <p><a href="${finalInterviewLink}">${finalInterviewLink}</a></p>
          <p>This link will expire in 7 days.</p>
        `,
      });

      emailStatus = "Sent";

      await supabase
        .from("interview_sessions")
        .update({
          invite_sent_at: new Date().toISOString(),
          email_status: "Sent",
        })
        .eq("id", session.id);
    }

    return NextResponse.json({
      message:
        start_type === "ON_DEMAND"
          ? "On-demand interview created successfully"
          : "Scheduled interview created successfully",
      session: {
        ...session,
        interview_link: finalInterviewLink,
        email_status: emailStatus,
      },
      questionStrategy: {
        adaptiveInterview: true,
        questionBankRequested: questionBankCount,
        aiGeneratedRequested: aiGeneratedCount,
        questionBankSelected: questionBankQuestions.length,
        aiGeneratedSelected: aiQuestions.length,
      },
      questionsSelected: answerRows.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}
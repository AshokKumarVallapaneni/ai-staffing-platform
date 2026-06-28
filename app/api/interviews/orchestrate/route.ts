import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { Resend } from "resend";
import crypto from "crypto";
import {
  createFallbackQuestion,
  findQuestionBankQuestion,
  generateQuestionForSkill,
  getDefaultDifficulty,
  getInterviewFocusAreas,
  getQuestionBankBlendRatio,
  isNonCodingProfile,
  loadApprovedQuestionBank,
  normalizeStringList,
  type ConsultantLike,
  type ExistingQuestion,
  type QuestionSource,
} from "@/lib/interview-question-engine";

export const runtime = "nodejs";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("consultants")
    .select(`
      id,
      full_name,
      email,
      profile_type,
      seniority,
      experience_years,
      primary_technical_skills,
      secondary_technical_skills,
      hands_on_skills,
      skills,
      professional_skills,
      tools,
      domain_experience
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      {
        error: "Failed to load consultants",
        details: error,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    consultants: data || [],
  });
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
      primary_technical_skills,
      send_email,
      started_by,
    } = body;

    if (!consultant_id) {
      return NextResponse.json(
        { error: "Consultant is required" },
        { status: 400 }
      );
    }

    if (start_type === "SCHEDULED" && !scheduled_at) {
      return NextResponse.json(
        { error: "Scheduled date and time are required" },
        { status: 400 }
      );
    }

    const { data: consultant, error: consultantError } = await supabaseAdmin
      .from("consultants")
      .select("*")
      .eq("id", consultant_id)
      .single();

    if (consultantError || !consultant) {
      return NextResponse.json(
        {
          error: "Consultant not found",
          details: consultantError,
        },
        { status: 404 }
      );
    }

    const typedConsultant = consultant as ConsultantLike;

    const focusAreas = getInterviewFocusAreas(
      typedConsultant,
      primary_technical_skills
    );

    if (focusAreas.length === 0) {
      return NextResponse.json(
        {
          error:
            "No interview skills or focus areas were identified for this consultant.",
        },
        { status: 400 }
      );
    }

    const domainContext = normalizeStringList(
      typedConsultant.domain_experience
    );

    const firstSkill = focusAreas[0];
    const difficulty = getDefaultDifficulty(
      typedConsultant.experience_years
    );

    const blendRatio = getQuestionBankBlendRatio(
      body.question_bank_blend_ratio
    );

    const requestedCoding = Boolean(coding_required);
    const effectiveCodingRequired =
      requestedCoding &&
      !isNonCodingProfile(typedConsultant.profile_type);

    const token = crypto.randomBytes(32).toString("hex");
    const baseUrl =
      process.env.APP_BASE_URL || "http://localhost:3000";

    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 7);

    const duration = Number(duration_minutes || 60);

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("interview_sessions")
      .insert({
        consultant_id,
        domain: typedConsultant.profile_type,
        technology: focusAreas.join(", "),
        experience: typedConsultant.experience_years
          ? String(typedConsultant.experience_years)
          : null,
        mode: start_type || "ON_DEMAND",
        interview_mode: interview_mode || "ONSITE",
        start_type: start_type || "ON_DEMAND",
        started_by: started_by || "Admin",
        duration_minutes: duration,

        // This is only the number of initially created rows.
        // The adaptive interview has no maximum question count.
        question_count: 1,

        adaptive_mode: true,
        primary_skills: focusAreas,
        current_skill: firstSkill,
        question_bank_blend_ratio: blendRatio,

        coding_required: effectiveCodingRequired,
        broken_code_required: Boolean(broken_code_required),
        system_design_required: Boolean(system_design_required),
        scheduled_at: scheduled_at || null,
        invite_token: token,
        invite_expires_at: inviteExpiresAt.toISOString(),
        interview_link: "",
        email_status: "Not Sent",
        status:
          start_type === "ON_DEMAND" ? "Ready" : "Scheduled",
      })
      .select()
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        {
          error: "Failed to create interview session",
          details: sessionError,
        },
        { status: 500 }
      );
    }

    const finalInterviewLink =
      start_type === "ON_DEMAND"
        ? `${baseUrl}/interviews/session/${session.id}`
        : `${baseUrl}/interviews/start/${token}`;

    const { error: linkError } = await supabaseAdmin
      .from("interview_sessions")
      .update({ interview_link: finalInterviewLink })
      .eq("id", session.id);

    if (linkError) {
      return NextResponse.json(
        {
          error: "Failed to create interview link",
          details: linkError,
        },
        { status: 500 }
      );
    }

    const assessmentRows = focusAreas.map((skill) => ({
      session_id: session.id,
      skill_name: skill,
      questions_asked: 0,
      current_difficulty: difficulty,
      coverage_status:
        skill === firstSkill ? "In Progress" : "Not Started",
    }));

    const { error: assessmentError } = await supabaseAdmin
      .from("interview_skill_assessments")
      .insert(assessmentRows);

    if (assessmentError) {
      return NextResponse.json(
        {
          error: "Failed to initialize skill assessments",
          details: assessmentError,
        },
        { status: 500 }
      );
    }

    const questionBank = await loadApprovedQuestionBank();

    const bankQuestion = findQuestionBankQuestion({
      questionBank,
      skill: firstSkill,
      difficulty,
      questionType: "Conceptual",
      profileType: typedConsultant.profile_type || "",
      existingQuestions: [] as ExistingQuestion[],
    });

    let questionText: string;
    let questionId: string | null;
    let questionSource: QuestionSource;
    let questionType:
      | "Conceptual"
      | "Scenario"
      | "Coding"
      | "Debugging"
      | "Architecture"
      | "Behavioral"
      | "Domain"
      | "SQL"
      | "Tool";
    let questionDifficulty:
      | "Easy"
      | "Medium"
      | "Hard"
      | "Expert";

    if (bankQuestion) {
      questionText = bankQuestion.question_text;
      questionId = bankQuestion.id;
      questionSource = "QUESTION_BANK";
      questionType =
        (bankQuestion.question_type as typeof questionType) ||
        "Conceptual";
      questionDifficulty =
        (bankQuestion.difficulty as typeof questionDifficulty) ||
        difficulty;
    } else {
      const generated = await generateQuestionForSkill({
        consultant: typedConsultant,
        skill: firstSkill,
        difficulty,
        domainContext,
        previousQuestions: [],
        purpose: "Open the adaptive interview with a relevant question.",
      });

      const fallback =
        generated || createFallbackQuestion(firstSkill, difficulty);

      questionText = fallback.question;
      questionId = null;
      questionSource = generated
        ? "AI_GENERATED"
        : "SYSTEM_GENERATED";
      questionType = fallback.questionType;
      questionDifficulty = fallback.difficulty;
    }

    const { data: firstAnswer, error: firstAnswerError } = await supabaseAdmin
      .from("interview_answers")
      .insert({
        session_id: session.id,
        question_id: questionId,
        question: questionText,
        answer_text: null,
        score: null,
        feedback: null,
        question_source: questionSource,
        topic: firstSkill,
        difficulty: questionDifficulty,
        question_type: questionType,
        parent_answer_id: null,
      })
      .select()
      .single();

    if (firstAnswerError || !firstAnswer) {
      return NextResponse.json(
        {
          error: "Failed to create the first interview question",
          details: firstAnswerError,
        },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("interview_transcript_messages").insert([
      {
        session_id: session.id,
        answer_id: null,
        speaker: "AI",
        message:
          "Welcome to your adaptive interview. The interview will focus on the skills identified in your resume.",
        message_type: "WELCOME",
        topic: null,
      },
      {
        session_id: session.id,
        answer_id: firstAnswer.id,
        speaker: "AI",
        message: questionText,
        message_type: "QUESTION",
        topic: firstSkill,
      },
    ]);

    let emailStatus = "Not Sent";

    if (send_email && typedConsultant.id && consultant.email && resend) {
      try {
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

        await supabaseAdmin
          .from("interview_sessions")
          .update({
            invite_sent_at: new Date().toISOString(),
            email_status: "Sent",
          })
          .eq("id", session.id);
      } catch (emailError) {
        console.error("Interview invite email failed:", emailError);
        emailStatus = "Failed";

        await supabaseAdmin
          .from("interview_sessions")
          .update({ email_status: "Failed" })
          .eq("id", session.id);
      }
    }

    return NextResponse.json({
      message:
        start_type === "ON_DEMAND"
          ? "On-demand adaptive interview created successfully"
          : "Scheduled adaptive interview created successfully",
      session: {
        ...session,
        interview_link: finalInterviewLink,
        email_status: emailStatus,
      },
      firstQuestion: firstAnswer,
      interviewStrategy: {
        adaptive: true,
        noMaximumQuestionCount: true,
        focusAreas,
        firstSkill,
        questionBankBlendRatio: blendRatio,
        questionSource,
        codingRequired: effectiveCodingRequired,
      },
    });
  } catch (error) {
    console.error("Interview orchestration error:", error);

    return NextResponse.json(
      {
        error: "Server error",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

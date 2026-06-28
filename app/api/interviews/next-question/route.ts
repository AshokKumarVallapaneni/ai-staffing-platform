import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  chooseNextUncoveredSkill,
  createFallbackQuestion,
  findQuestionBankQuestion,
  generateQuestionForSkill,
  getDefaultDifficulty,
  getInterviewFocusAreas,
  getOpenAIOutputText,
  getQuestionBankBlendRatio,
  isCovered,
  isNonCodingProfile,
  loadApprovedQuestionBank,
  normalizeStringList,
  normalizeText,
  shouldUseQuestionBank,
  type ConsultantLike,
  type CoverageStatus,
  type Difficulty,
  type ExistingQuestion,
  type QuestionSource,
  type QuestionType,
} from "@/lib/interview-question-engine";
import { supabase } from "@/lib/supabase";


export const runtime = "nodejs";

type InterviewDecision =
  | "ASK_FOLLOW_UP"
  | "ASK_DEEPER_QUESTION"
  | "ASK_NEXT_SKILL_QUESTION"
  | "MOVE_TO_NEXT_SKILL"
  | "START_CODING_ROUND"
  | "END_INTERVIEW";

type EvaluationResult = {
  feedback: string;
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  decision: InterviewDecision;
  coverageStatus: CoverageStatus;
  skillConfidence: number;
  nextSkill: string;
  nextDifficulty: Difficulty;
  nextQuestion: string;
  questionType: QuestionType;
  strengths: string;
  weaknesses: string;
};

type SkillAssessment = {
  skill_name: string;
  questions_asked: number;
  average_score: number | null;
  current_difficulty: string | null;
  confidence_level: number | null;
  coverage_status: CoverageStatus;
};

const MIN_EVIDENCE_QUESTIONS_PER_SKILL = Number(
  process.env.MIN_EVIDENCE_QUESTIONS_PER_SKILL || 2
);

export async function POST(req: Request) {
  try {
    const { sessionId, answerId, answerText } = await req.json();

    if (!sessionId || !answerId) {
      return NextResponse.json(
        { error: "sessionId and answerId are required" },
        { status: 400 }
      );
    }

    const cleanedAnswer = String(answerText || "").trim();

    if (!cleanedAnswer) {
      return NextResponse.json(
        { error: "Please provide an answer before continuing" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const { data: currentAnswer, error: currentAnswerError } =
      await supabaseAdmin
        .from("interview_answers")
        .select(`
          id,
          session_id,
          question_id,
          question,
          topic,
          difficulty,
          question_type,
          question_source
        `)
        .eq("id", answerId)
        .eq("session_id", sessionId)
        .single();

    if (currentAnswerError || !currentAnswer) {
      return NextResponse.json(
        {
          error: "Current interview question was not found",
          details: currentAnswerError,
        },
        { status: 404 }
      );
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("interview_sessions")
      .select(`
        id,
        status,
        coding_required,
        system_design_required,
        primary_skills,
        question_bank_blend_ratio,
        consultants (
          id,
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
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        {
          error: "Interview session was not found",
          details: sessionError,
        },
        { status: 404 }
      );
    }

    const consultantValue = session.consultants as
      | ConsultantLike
      | ConsultantLike[]
      | null;

    const consultant = Array.isArray(consultantValue)
      ? consultantValue[0]
      : consultantValue;

    if (!consultant) {
      return NextResponse.json(
        { error: "Consultant details were not found" },
        { status: 404 }
      );
    }

    const focusAreas = getInterviewFocusAreas(
      consultant,
      session.primary_skills
    );

    if (focusAreas.length === 0) {
      return NextResponse.json(
        { error: "No interview focus areas were identified" },
        { status: 400 }
      );
    }

    const currentSkill = currentAnswer.topic || focusAreas[0];

    const currentDifficulty =
      (currentAnswer.difficulty as Difficulty) ||
      getDefaultDifficulty(consultant.experience_years);

    const domainContext = normalizeStringList(
      consultant.domain_experience
    );

    const { data: existingAnswers, error: existingAnswersError } =
      await supabaseAdmin
        .from("interview_answers")
        .select(`
          id,
          question_id,
          question,
          topic,
          difficulty,
          question_type,
          question_source,
          score,
          answer_text
        `)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

    if (existingAnswersError) {
      return NextResponse.json(
        {
          error: "Failed to load previous interview questions",
          details: existingAnswersError,
        },
        { status: 500 }
      );
    }

    const typedExistingAnswers =
      (existingAnswers || []) as ExistingQuestion[];

    const previousQuestionsForSkill = typedExistingAnswers
      .filter(
        (item) =>
          normalizeText(item.topic) === normalizeText(currentSkill)
      )
      .map((item) => item.question);

    const { data: assessments, error: assessmentsError } =
      await supabaseAdmin
        .from("interview_skill_assessments")
        .select(`
          skill_name,
          questions_asked,
          average_score,
          current_difficulty,
          confidence_level,
          coverage_status
        `)
        .eq("session_id", sessionId);

    if (assessmentsError) {
      return NextResponse.json(
        {
          error: "Failed to load skill assessments",
          details: assessmentsError,
        },
        { status: 500 }
      );
    }

    const skillAssessments =
      (assessments || []) as SkillAssessment[];

    const prompt = `
You are an adaptive senior interviewer.

Evaluate the candidate's latest answer and decide the best next action.

Candidate profile:
${consultant.profile_type || "Not provided"}

Seniority:
${consultant.seniority || "Not provided"}

Experience:
${consultant.experience_years || 0} years

Interview focus areas:
${JSON.stringify(focusAreas)}

Current focus area:
${currentSkill}

Current difficulty:
${currentDifficulty}

Current question:
${currentAnswer.question}

Candidate answer:
${cleanedAnswer}

Previously asked questions for this focus area:
${JSON.stringify(previousQuestionsForSkill)}

Current assessments:
${JSON.stringify(skillAssessments)}

Domain context:
${JSON.stringify(domainContext)}

Rules:
- There is no maximum question count.
- Continue while additional evidence is useful.
- Do not repeat or lightly rephrase a previous question.
- Weak or unclear answers should receive clarification or a foundational follow-up.
- Reasonable answers should receive a deeper practical question.
- Strong answers should receive harder production, debugging, performance,
  security, architecture, or trade-off questions.
- Move to another focus area only when the current one has sufficient evidence.
- Domain experience is context only. Never ask standalone business-domain questions.
- Every next question must primarily evaluate one listed focus area.
- Coding is allowed only for coding profiles.
- END_INTERVIEW is allowed only when every focus area has sufficient evidence.
`;

    const aiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model:
            process.env.OPENAI_INTERVIEW_MODEL || "gpt-4o-mini",
          input: prompt,
          max_output_tokens: 1500,
          text: {
            format: {
              type: "json_schema",
              name: "adaptive_interview_decision",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  feedback: { type: "string" },
                  technicalScore: {
                    type: "integer",
                    minimum: 0,
                    maximum: 100,
                  },
                  communicationScore: {
                    type: "integer",
                    minimum: 0,
                    maximum: 100,
                  },
                  confidenceScore: {
                    type: "integer",
                    minimum: 0,
                    maximum: 100,
                  },
                  decision: {
                    type: "string",
                    enum: [
                      "ASK_FOLLOW_UP",
                      "ASK_DEEPER_QUESTION",
                      "ASK_NEXT_SKILL_QUESTION",
                      "MOVE_TO_NEXT_SKILL",
                      "START_CODING_ROUND",
                      "END_INTERVIEW",
                    ],
                  },
                  coverageStatus: {
                    type: "string",
                    enum: [
                      "Not Started",
                      "In Progress",
                      "Needs Validation",
                      "Sufficiently Covered",
                      "Strongly Validated",
                    ],
                  },
                  skillConfidence: {
                    type: "integer",
                    minimum: 0,
                    maximum: 100,
                  },
                  nextSkill: { type: "string" },
                  nextDifficulty: {
                    type: "string",
                    enum: ["Easy", "Medium", "Hard", "Expert"],
                  },
                  nextQuestion: { type: "string" },
                  questionType: {
                    type: "string",
                    enum: [
                      "Conceptual",
                      "Scenario",
                      "Coding",
                      "Debugging",
                      "Architecture",
                      "Behavioral",
                      "Domain",
                      "SQL",
                      "Tool",
                    ],
                  },
                  strengths: { type: "string" },
                  weaknesses: { type: "string" },
                },
                required: [
                  "feedback",
                  "technicalScore",
                  "communicationScore",
                  "confidenceScore",
                  "decision",
                  "coverageStatus",
                  "skillConfidence",
                  "nextSkill",
                  "nextDifficulty",
                  "nextQuestion",
                  "questionType",
                  "strengths",
                  "weaknesses",
                ],
              },
            },
          },
        }),
      }
    );

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
      return NextResponse.json(
        {
          error: "AI interview evaluation failed",
          details: aiData,
        },
        { status: 500 }
      );
    }

    const outputText = getOpenAIOutputText(aiData);

    if (!outputText) {
      return NextResponse.json(
        { error: "AI did not return an interview decision" },
        { status: 500 }
      );
    }

    const result = JSON.parse(outputText) as EvaluationResult;

    const { error: answerUpdateError } = await supabaseAdmin
      .from("interview_answers")
      .update({
        answer_text: cleanedAnswer,
        feedback: result.feedback,
        score: result.technicalScore,
        technical_score: result.technicalScore,
        communication_score: result.communicationScore,
        confidence_score: result.confidenceScore,
      })
      .eq("id", answerId);

    if (answerUpdateError) {
      return NextResponse.json(
        {
          error: "Failed to save the interview answer",
          details: answerUpdateError,
        },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("interview_transcript_messages").insert({
      session_id: sessionId,
      answer_id: answerId,
      speaker: "CANDIDATE",
      message: cleanedAnswer,
      message_type: "ANSWER",
      topic: currentSkill,
    });

    const priorScores = typedExistingAnswers
      .filter(
        (item) =>
          item.id !== answerId &&
          normalizeText(item.topic) === normalizeText(currentSkill) &&
          typeof item.score === "number"
      )
      .map((item) => Number(item.score));

    const updatedScores = [...priorScores, result.technicalScore];

    const averageScore = Math.round(
      updatedScores.reduce((sum, score) => sum + score, 0) /
        updatedScores.length
    );

    const questionsAsked = typedExistingAnswers.filter(
      (item) =>
        normalizeText(item.topic) === normalizeText(currentSkill)
    ).length;

    let enforcedCoverage = result.coverageStatus;

    if (
      isCovered(enforcedCoverage) &&
      questionsAsked < MIN_EVIDENCE_QUESTIONS_PER_SKILL
    ) {
      enforcedCoverage = "In Progress";
    }

    const { error: assessmentUpsertError } = await supabaseAdmin
      .from("interview_skill_assessments")
      .upsert(
        {
          session_id: sessionId,
          skill_name: currentSkill,
          questions_asked: questionsAsked,
          average_score: averageScore,
          current_difficulty: result.nextDifficulty,
          confidence_level: result.skillConfidence,
          coverage_status: enforcedCoverage,
          strengths: result.strengths,
          weaknesses: result.weaknesses,
          last_question_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "session_id,skill_name",
        }
      );

    if (assessmentUpsertError) {
      return NextResponse.json(
        {
          error: "Failed to update skill assessment",
          details: assessmentUpsertError,
        },
        { status: 500 }
      );
    }

    const updatedAssessments = skillAssessments.filter(
      (assessment) =>
        normalizeText(assessment.skill_name) !==
        normalizeText(currentSkill)
    );

    updatedAssessments.push({
      skill_name: currentSkill,
      questions_asked: questionsAsked,
      average_score: averageScore,
      current_difficulty: result.nextDifficulty,
      confidence_level: result.skillConfidence,
      coverage_status: enforcedCoverage,
    });

    const allSkillsCovered = focusAreas.every((skill) => {
      const assessment = updatedAssessments.find(
        (item) =>
          normalizeText(item.skill_name) === normalizeText(skill)
      );

      return isCovered(assessment?.coverage_status);
    });

    const codingAllowed =
      Boolean(session.coding_required) &&
      !isNonCodingProfile(consultant.profile_type);

    const { count: codingSubmissionCount } = await supabase
      .from("interview_coding_answers")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("session_id", sessionId);

    const codingCompleted = Number(codingSubmissionCount || 0) > 0;

    let finalDecision = result.decision;

    if (
      finalDecision === "START_CODING_ROUND" &&
      !allSkillsCovered
    ) {
      finalDecision = "MOVE_TO_NEXT_SKILL";
    }

    if (
      finalDecision === "START_CODING_ROUND" &&
      !codingAllowed
    ) {
      finalDecision = allSkillsCovered
        ? "END_INTERVIEW"
        : "MOVE_TO_NEXT_SKILL";
    }

    if (finalDecision === "END_INTERVIEW" && !allSkillsCovered) {
      finalDecision = "MOVE_TO_NEXT_SKILL";
    }

    if (
      finalDecision === "END_INTERVIEW" &&
      codingAllowed &&
      !codingCompleted
    ) {
      finalDecision = "START_CODING_ROUND";
    }

    if (finalDecision === "START_CODING_ROUND") {
      await supabase
        .from("interview_sessions")
        .update({
          status: "In Progress",
          current_skill: currentSkill,
        })
        .eq("id", sessionId);

      return NextResponse.json({
        success: true,
        decision: "START_CODING_ROUND",
        evaluation: {
          ...result,
          coverageStatus: enforcedCoverage,
        },
        codingUrl: `/interviews/coding/${sessionId}`,
      });
    }

    if (finalDecision === "END_INTERVIEW") {
      return NextResponse.json({
        success: true,
        decision: "END_INTERVIEW",
        evaluation: {
          ...result,
          coverageStatus: enforcedCoverage,
        },
      });
    }

    let nextSkill = currentSkill;

    if (finalDecision === "MOVE_TO_NEXT_SKILL") {
      const uncoveredSkill = chooseNextUncoveredSkill(
        focusAreas,
        updatedAssessments,
        currentSkill
      );

      if (uncoveredSkill) {
        nextSkill = uncoveredSkill;
      } else if (codingAllowed && !codingCompleted) {
        return NextResponse.json({
          success: true,
          decision: "START_CODING_ROUND",
          evaluation: result,
          codingUrl: `/interviews/coding/${sessionId}`,
        });
      } else {
        return NextResponse.json({
          success: true,
          decision: "END_INTERVIEW",
          evaluation: result,
        });
      }
    }

    const matchedFocusArea =
      focusAreas.find(
        (skill) =>
          normalizeText(skill) === normalizeText(nextSkill)
      ) || currentSkill;

    nextSkill = matchedFocusArea;

    const questionBank = await loadApprovedQuestionBank();

    const bankQuestion = findQuestionBankQuestion({
      questionBank,
      skill: nextSkill,
      difficulty: result.nextDifficulty,
      questionType: result.questionType,
      profileType: consultant.profile_type || "",
      existingQuestions: typedExistingAnswers,
    });

    let aiQuestionText = result.nextQuestion.trim();
    let aiQuestionType = result.questionType;
    let aiDifficulty = result.nextDifficulty;

    const resultSkillMatches =
      normalizeText(result.nextSkill) === normalizeText(nextSkill) ||
      normalizeText(nextSkill) === normalizeText(currentSkill);

    if (!aiQuestionText || !resultSkillMatches) {
      const generated = await generateQuestionForSkill({
        consultant,
        skill: nextSkill,
        difficulty: result.nextDifficulty,
        domainContext,
        previousQuestions: typedExistingAnswers
          .filter(
            (item) =>
              normalizeText(item.topic) === normalizeText(nextSkill)
          )
          .map((item) => item.question),
        purpose:
          finalDecision === "MOVE_TO_NEXT_SKILL"
            ? "Begin evaluation of the next uncovered focus area."
            : "Continue adaptive evaluation based on the latest answer.",
      });

      if (generated) {
        aiQuestionText = generated.question;
        aiQuestionType = generated.questionType;
        aiDifficulty = generated.difficulty;
      }
    }

    const fallback = createFallbackQuestion(
      nextSkill,
      result.nextDifficulty
    );

    if (!aiQuestionText) {
      aiQuestionText = fallback.question;
      aiQuestionType = fallback.questionType;
      aiDifficulty = fallback.difficulty;
    }

    const duplicateAIQuestion = typedExistingAnswers.some(
      (item) =>
        normalizeText(item.question) === normalizeText(aiQuestionText)
    );

    if (duplicateAIQuestion) {
      aiQuestionText = fallback.question;
      aiQuestionType = fallback.questionType;
      aiDifficulty = fallback.difficulty;
    }

    const blendRatio = getQuestionBankBlendRatio(
      session.question_bank_blend_ratio
    );

    const useQuestionBank = shouldUseQuestionBank({
      existingQuestions: typedExistingAnswers,
      skill: nextSkill,
      bankAvailable: Boolean(bankQuestion),
      aiAvailable: Boolean(aiQuestionText),
      targetRatio: blendRatio,
    });

    let finalQuestionText: string;
    let finalQuestionId: string | null;
    let finalQuestionSource: QuestionSource;
    let finalQuestionType: QuestionType;
    let finalDifficulty: Difficulty;

    if (useQuestionBank && bankQuestion) {
      finalQuestionText = bankQuestion.question_text;
      finalQuestionId = bankQuestion.id;
      finalQuestionSource = "QUESTION_BANK";
      finalQuestionType =
        (bankQuestion.question_type as QuestionType) ||
        aiQuestionType;
      finalDifficulty =
        (bankQuestion.difficulty as Difficulty) ||
        aiDifficulty;
    } else {
      finalQuestionText = aiQuestionText;
      finalQuestionId = null;
      finalQuestionSource = duplicateAIQuestion
        ? "SYSTEM_GENERATED"
        : "AI_GENERATED";
      finalQuestionType = aiQuestionType;
      finalDifficulty = aiDifficulty;
    }

    const { data: insertedQuestion, error: insertError } =
      await supabase
        .from("interview_answers")
        .insert({
          session_id: sessionId,
          question_id: finalQuestionId,
          question: finalQuestionText,
          answer_text: null,
          score: null,
          feedback: null,
          question_source: finalQuestionSource,
          topic: nextSkill,
          difficulty: finalDifficulty,
          question_type: finalQuestionType,
          parent_answer_id: answerId,
        })
        .select(`
          id,
          question_id,
          question,
          answer_text,
          question_source,
          topic,
          difficulty,
          question_type
        `)
        .single();

    if (insertError || !insertedQuestion) {
      return NextResponse.json(
        {
          error: "Failed to save the next interview question",
          details: insertError,
        },
        { status: 500 }
      );
    }

    await supabase
      .from("interview_sessions")
      .update({
        status: "In Progress",
        current_skill: nextSkill,
      })
      .eq("id", sessionId);

    await supabase.from("interview_transcript_messages").insert({
      session_id: sessionId,
      answer_id: insertedQuestion.id,
      speaker: "AI",
      message: finalQuestionText,
      message_type:
        finalQuestionSource === "QUESTION_BANK"
          ? "QUESTION_BANK_QUESTION"
          : "REAL_TIME_AI_QUESTION",
      topic: nextSkill,
    });

    return NextResponse.json({
      success: true,
      decision: finalDecision,
      evaluation: {
        ...result,
        coverageStatus: enforcedCoverage,
      },
      nextQuestion: insertedQuestion,
      currentSkill,
      nextSkill,
      selection: {
        source: finalQuestionSource,
        questionBankBlendRatio: blendRatio,
      },
    });
  } catch (error) {
    console.error("Adaptive next-question error:", error);

    return NextResponse.json(
      {
        error: "Server error",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

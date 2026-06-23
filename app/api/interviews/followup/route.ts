import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const {
      sessionId,
      question,
      answer,
      answerId,
    } = await req.json();

    if (!sessionId || !question || !answer) {
      return NextResponse.json(
        {
          error: "sessionId, question and answer are required",
        },
        { status: 400 }
      );
    }

   const prompt = `
You are a senior technical interviewer.

You must evaluate the candidate answer and decide the next action.

Original Question:
${question}

Candidate Answer:
${answer}

Return ONLY valid JSON.

{
  "feedback": "",
  "technicalScore": 0,
  "communicationScore": 0,
  "confidenceScore": 0,
  "decision": "",
  "followUpQuestion": ""
}

Rules:
- If the answer is empty, weak, vague, or unrelated, ask a simple clarification follow-up.
- If the answer is decent, ask a deeper scenario-based follow-up.
- If the answer is strong, set decision to "NEXT_TOPIC".
- Do NOT repeat or rephrase the original question.
- The followUpQuestion must be different from the original question.
- The followUpQuestion must probe deeper into the candidate's answer.
- If candidate did not answer properly, ask them to explain with a real project example.
- decision must be one of:
  FOLLOW_UP
  NEXT_TOPIC
  START_CODING_ROUND
  END_INTERVIEW

Examples:
Bad follow-up:
${question}

Good follow-up:
Can you give a real project example and explain what trade-offs you considered?

Return JSON only.
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
          model: "gpt-4o-mini",
          input: prompt,
        }),
      }
    );

    const data = await aiResponse.json();

    if (!aiResponse.ok) {
      return NextResponse.json(
        {
          error: "AI evaluation failed",
          details: data,
        },
        { status: 500 }
      );
    }

    const outputText =
      data.output_text ||
      data.output?.[0]?.content?.find(
        (c: any) => c.type === "output_text"
      )?.text;

    if (!outputText) {
      return NextResponse.json(
        {
          error: "AI did not return output",
        },
        { status: 500 }
      );
    }

    const result = JSON.parse(outputText);

    // Save answer scores
    if (answerId) {
      await supabase
        .from("interview_answers")
        .update({
          technical_score:
            result.technicalScore || 0,

          communication_score:
            result.communicationScore || 0,

          confidence_score:
            result.confidenceScore || 0,

          feedback:
            result.feedback || null,
        })
        .eq("id", answerId);
    }

    // Save candidate response transcript
    await supabase
      .from("interview_transcript")
      .insert([
        {
          session_id: sessionId,
          speaker: "Candidate",
          message: answer,
        },
      ]);

    // Save AI follow-up transcript
    if (
      result.decision === "FOLLOW_UP" &&
      result.followUpQuestion
    ) {
      await supabase
        .from("interview_transcript")
        .insert([
          {
            session_id: sessionId,
            speaker: "AI",
            message:
              result.followUpQuestion,
          },
        ]);
    }

    return NextResponse.json({
      success: true,

      feedback:
        result.feedback || "",

      technicalScore:
        result.technicalScore || 0,

      communicationScore:
        result.communicationScore || 0,

      confidenceScore:
        result.confidenceScore || 0,

      decision:
        result.decision || "NEXT_TOPIC",

      followUpQuestion:
        result.followUpQuestion || "",
    });
  } catch (error) {
    console.error(
      "Interview Follow-up Error:",
      error
    );

    return NextResponse.json(
      {
        error: "Server Error",
        details: String(error),
      },
      { status: 500 }
    );
  }
}
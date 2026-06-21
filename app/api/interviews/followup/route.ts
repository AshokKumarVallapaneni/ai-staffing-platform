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
You are a Senior Technical Interviewer.

Question:
${question}

Candidate Answer:
${answer}

Evaluate the answer.

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

- technicalScore = 0 to 100
- communicationScore = 0 to 100
- confidenceScore = 0 to 100

decision must be one of:

FOLLOW_UP
NEXT_TOPIC
START_CODING_ROUND
END_INTERVIEW

FOLLOW_UP:
Generate a deeper technical follow-up question.

NEXT_TOPIC:
No follow-up question.

START_CODING_ROUND:
No follow-up question.

END_INTERVIEW:
No follow-up question.

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
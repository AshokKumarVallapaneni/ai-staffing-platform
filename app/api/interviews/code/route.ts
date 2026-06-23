import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const {
      sessionId,
      answerId,
      questionNumber,
      language,
      question,
      sourceCode,
    } = await req.json();

    if (!sessionId || !question || !sourceCode) {
      return NextResponse.json(
        { error: "sessionId, question and sourceCode are required" },
        { status: 400 }
      );
    }

    const prompt = `
You are a senior technical interviewer evaluating a live coding round.

Coding Question:
${question}

Question Number:
${questionNumber || "N/A"}

Language:
${language || "Not specified"}

Candidate Code:
${sourceCode}

Evaluate the code.

Return ONLY valid JSON.

{
  "score": 0,
  "feedback": "",
  "executionResult": "",
  "strengths": [],
  "weaknesses": []
}

Rules:
- score must be 0 to 100.
- Evaluate correctness, readability, edge cases, complexity, maintainability.
- If code does not compile logically, explain why.
- Do not execute code.
- executionResult should be a short simulated result or validation summary.
- Mention whether the solution matches the requested language and problem.
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
      return NextResponse.json(
        { error: "AI code evaluation failed", details: data },
        { status: 500 }
      );
    }

    const outputText =
      data.output_text ||
      data.output?.[0]?.content?.find(
        (c: { type: string; text?: string }) => c.type === "output_text"
      )?.text;

    if (!outputText) {
      return NextResponse.json(
        { error: "AI did not return output" },
        { status: 500 }
      );
    }

    const result = JSON.parse(outputText);

    const { data: inserted, error } = await supabase
      .from("interview_coding_answers")
      .insert({
        session_id: sessionId,
        answer_id: answerId || null,
        question_number: questionNumber || null,
        language: language || "text",
        question,
        source_code: sourceCode,
        execution_result: result.executionResult || "",
        score: result.score || 0,
        feedback: result.feedback || "",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to save coding answer", details: error },
        { status: 500 }
      );
    }

    const { data: allCodingAnswers } = await supabase
      .from("interview_coding_answers")
      .select("score")
      .eq("session_id", sessionId);

    const scores =
      allCodingAnswers
        ?.map((x) => Number(x.score))
        .filter((x) => !Number.isNaN(x)) || [];

    const avgCodingScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : result.score || 0;

    await supabase
      .from("interview_sessions")
      .update({
        coding_score: avgCodingScore,
      })
      .eq("id", sessionId);

    return NextResponse.json({
      success: true,
      codingAnswer: inserted,
      evaluation: result,
      codingScore: avgCodingScore,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}
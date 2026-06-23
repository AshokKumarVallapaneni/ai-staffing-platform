import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const NON_CODING_PROFILES = [
  "Bench Sales Recruiter",
  "IT Recruiter",
  "Business Analyst",
  "Product Owner",
  "Product Manager",
  "Sales / Business Development",
];

function getDifficulty(experienceYears?: number | null) {
  const exp = Number(experienceYears || 0);

  if (exp <= 2) return "Beginner";
  if (exp <= 5) return "Intermediate";
  if (exp <= 8) return "Advanced";
  if (exp <= 12) return "Lead";
  return "Architect";
}

function getDefaultLanguage(profileType: string) {
  const p = profileType.toLowerCase();

  if (p.includes(".net")) return "csharp";
  if (p.includes("java")) return "java";
  if (p.includes("python")) return "python";
  if (p.includes("angular")) return "typescript";
  if (p.includes("data") || p.includes("sql")) return "sql";
  if (p.includes("qa") || p.includes("sdet")) return "javascript";

  return "javascript";
}

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const { data: session, error } = await supabase
      .from("interview_sessions")
      .select(`
        *,
        consultants (
          id,
          full_name,
          profile_type,
          seniority,
          experience_years,
          hands_on_skills,
          skills,
          domain_skills,
          technology_domains_handled,
          tools
        )
      `)
      .eq("id", sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: "Interview session not found", details: error },
        { status: 404 }
      );
    }

    const consultant = session.consultants;
    const profileType = consultant?.profile_type || "Developer";
    const experienceYears = consultant?.experience_years || 0;
    const difficulty = getDifficulty(experienceYears);

    const requiresCoding = !NON_CODING_PROFILES.some(
      (p) => p.toLowerCase() === profileType.toLowerCase()
    );

    await supabase
      .from("interview_sessions")
      .update({
        requires_coding: requiresCoding,
        difficulty_level: difficulty,
      })
      .eq("id", sessionId);

    if (!requiresCoding) {
      return NextResponse.json({
        requiresCoding: false,
        message: "Coding round is not required for this profile.",
        questions: [],
      });
    }

    const defaultLanguage = getDefaultLanguage(profileType);

    const prompt = `
You are a senior technical interviewer.

Generate exactly 3 live coding questions for this candidate.

Candidate Profile:
${profileType}

Experience Years:
${experienceYears}

Difficulty:
${difficulty}

Skills:
${JSON.stringify(consultant?.hands_on_skills || consultant?.skills || [])}

Domain Skills:
${JSON.stringify(consultant?.domain_skills || [])}

Technology Domains:
${JSON.stringify(consultant?.technology_domains_handled || [])}

Rules:
- Questions must match the candidate profile.
- For .NET profiles, use C#, SQL, Web API, LINQ, EF Core, async/await.
- For Java profiles, use Java, Spring Boot, REST API, collections, streams, microservices.
- For Python profiles, use Python, FastAPI, data structures, SQL.
- For Angular profiles, use TypeScript, RxJS, components, services.
- For Data profiles, use SQL, ETL, Spark, Snowflake, data validation.
- For QA/SDET, use automation, API testing, Selenium/Playwright style.
- Do not generate coding questions for recruiting or business profiles.
- Difficulty must be appropriate for experience.
- Return ONLY valid JSON array.

Return format:
[
  {
    "question_number": 1,
    "language": "${defaultLanguage}",
    "difficulty": "${difficulty}",
    "question": ""
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

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
      return NextResponse.json(
        { error: "AI coding question generation failed", details: aiData },
        { status: 500 }
      );
    }

    const outputText =
      aiData.output_text ||
      aiData.output?.[0]?.content?.find(
        (c: { type: string; text?: string }) => c.type === "output_text"
      )?.text;

    if (!outputText) {
      return NextResponse.json(
        { error: "AI did not return coding questions" },
        { status: 500 }
      );
    }

    const questions = JSON.parse(outputText);

    return NextResponse.json({
      requiresCoding: true,
      profileType,
      difficulty,
      questions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}
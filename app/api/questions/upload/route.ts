import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type RawQuestion = {
  question_text: string;
  client_name?: string;
  role_name?: string;
};

type TaggedQuestion = {
  question_text: string;
  profile_type: string;
  technology: string;
  sub_technology: string;
  category: string;
  sub_category: string;
  difficulty: string;
  question_type: string;
  source_type: string;
  expected_answer: string;
  expected_concepts: string[];
  follow_up_templates: string[];
  client_name?: string;
  role_name?: string;
  confidence_score: number;
};

function extractQuestionsFromWorkbook(buffer: Buffer): RawQuestion[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return rows
    .map((row) => {
      const normalized: Record<string, string> = {};

      Object.keys(row).forEach((key) => {
        normalized[key.trim().toLowerCase()] = String(row[key] || "").trim();
      });

      return {
        question_text:
          normalized.question_text ||
          normalized.question ||
          normalized.questions ||
          normalized["interview question"] ||
          "",
        client_name: normalized.client_name || normalized.client || "",
        role_name: normalized.role_name || normalized.role || "",
      };
    })
    .filter((q) => q.question_text.length > 5);
}

function extractQuestionsFromText(text: string): RawQuestion[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\d+[\).\-\s]+/, "").trim())
    .filter((line) => line.length > 5)
    .map((line) => ({
      question_text: line,
    }));
}

async function tagQuestionsWithAI(
  questions: RawQuestion[]
): Promise<TaggedQuestion[]> {
  const prompt = `
You are a Question Intelligence Agent for an AI Interview Platform.

Your task:
Analyze each interview question and auto-tag it for the question bank.

Return ONLY valid JSON.
Do not include markdown.
Do not include explanation.

For each question, return:
{
  "question_text": "",
  "profile_type": "",
  "technology": "",
  "sub_technology": "",
  "category": "",
  "sub_category": "",
  "difficulty": "",
  "question_type": "",
  "source_type": "Real Interview",
  "expected_answer": "",
  "expected_concepts": [],
  "follow_up_templates": [],
  "confidence_score": 0
}

Supported profile_type examples:
.NET Full Stack Developer
Java Full Stack Developer
Java Backend Developer
Python Backend Developer
Data Engineer
Data Analyst
Healthcare Data Analyst
QA Automation Engineer
SDET
QA Lead
DevOps Engineer
Cloud Engineer
Network Engineer
Network Security Engineer
Product Owner
Product Manager
Business Analyst
Bench Sales Recruiter
IT Recruiter
NetSuite Consultant
Salesforce Consultant
CSV Validation Specialist
Validation Engineer
Pharma Quality Assurance
Regulatory Affairs Specialist
Healthcare / Clinical
Sales / Business Development
Other

Rules:
- Detect technology from the actual question.
- Detect sub_technology as the specific concept.
- category should be broad, like Backend, Frontend, Database, Cloud, Data Engineering, QA, Recruitment, Healthcare, Product, DevOps, Networking.
- sub_category should be more specific, like Dependency Injection, Kafka Consumer Groups, SQL Joins, Selenium Framework, Visa Status, Rate Negotiation.
- difficulty must be Easy, Medium, Hard, or Expert.
- question_type must be Conceptual, Scenario, Coding, Debugging, Architecture, Behavioral, Domain, SQL, or Tool.
- expected_answer should be a short interviewer-friendly answer.
- expected_concepts should be important keywords/concepts.
- follow_up_templates should include 2 to 4 strong follow-up questions.
- confidence_score should be a number from 0 to 100 based on how confident you are about the auto-tagging.
- 90 to 100 means highly confident.
- 70 to 89 means probably correct.
- 50 to 69 means needs human review.
- Below 50 means low confidence.- If the question is about W2, C2C, H1B, OPT, CPT, vendor, hotlist, submission, or rate negotiation, classify as Bench Sales Recruiter or IT Recruiter.
- If the question is about CAPA, deviation, GxP, CSV, IQ/OQ/PQ, 21 CFR Part 11, classify as Validation/Pharma/CSV.
- If uncertain, use Other.
Return JSON array only.

Questions:
${JSON.stringify(questions, null, 2)}
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
    throw new Error(JSON.stringify(data));
  }

  const outputText =
    data.output_text ||
    data.output?.[0]?.content?.find(
      (c: { type: string; text?: string }) => c.type === "output_text"
    )?.text;

  if (!outputText) {
    throw new Error("AI did not return output.");
  }

  try {
  return JSON.parse(outputText);
} catch (error) {
  console.error("AI JSON parse error:", error);
  console.error("Raw AI output:", outputText);
  throw new Error("AI returned invalid JSON.");
}
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("question_file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "Please upload an Excel, CSV, or TXT file." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    let rawQuestions: RawQuestion[] = [];

    if (
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls") ||
      fileName.endsWith(".csv")
    ) {
      rawQuestions = extractQuestionsFromWorkbook(buffer);
    } else if (fileName.endsWith(".txt")) {
      rawQuestions = extractQuestionsFromText(buffer.toString("utf-8"));
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Upload .xlsx, .csv, or .txt." },
        { status: 400 }
      );
    }

    if (rawQuestions.length === 0) {
      return NextResponse.json(
        { error: "No valid questions found in file." },
        { status: 400 }
      );
    }

    const taggedQuestions = await tagQuestionsWithAI(rawQuestions.slice(0, 50));

    const rowsToInsert = taggedQuestions.map((q) => ({
      question_text: q.question_text,
      profile_type: q.profile_type,
      technology: q.technology,
      sub_technology: q.sub_technology,
      category: q.category,
      sub_category: q.sub_category,
      difficulty: q.difficulty,
      question_type: q.question_type,
      source_type: q.source_type || "Real Interview",
      expected_answer: q.expected_answer,
      expected_concepts: q.expected_concepts || [],
      follow_up_templates: q.follow_up_templates || [],
      confidence_score: q.confidence_score || 0,
      client_name: q.client_name || null,
      role_name: q.role_name || null,
      is_active: true,
    }));

    const { data: inserted, error } = await supabase
      .from("question_bank")
      .insert(rowsToInsert)
      .select();

    if (error) {
      return NextResponse.json(
        { error: "Question insert failed", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Questions uploaded successfully",
      extractedCount: rawQuestions.length,
      insertedCount: inserted?.length || 0,
      questions: inserted,
    });
  } catch (error) {
    console.error("Question upload error:", error);

    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}
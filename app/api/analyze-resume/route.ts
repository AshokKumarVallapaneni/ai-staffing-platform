import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export const runtime = "nodejs";

async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    return pdfData.text;
  }

  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (file.type === "text/plain" || file.name.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  throw new Error("Unsupported file type. Upload PDF, DOCX, or TXT.");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const full_name = String(formData.get("full_name") || "");
    const email = String(formData.get("email") || "");
    const phone = String(formData.get("phone") || "");
    const linkedin_profile = String(formData.get("linkedin_profile") || "");
    const pastedResumeText = String(formData.get("resume_text") || "");
    const file = formData.get("resume_file") as File | null;

    if (!full_name || !email) {
      return NextResponse.json(
        { error: "Full name and email are required" },
        { status: 400 }
      );
    }

    let resume_text = pastedResumeText;

    if (file && file.size > 0) {
      resume_text = await extractTextFromFile(file);
    }

    if (!resume_text || resume_text.trim().length < 20) {
      return NextResponse.json(
        { error: "Please upload a resume file or paste resume text" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing" },
        { status: 500 }
      );
    }

   const prompt = `
You are an Expert Resume Intelligence Agent for an AI Staffing Platform.

Your purpose is NOT to summarize resumes.

Your purpose is to:

1. Classify the candidate profile accurately.
2. Identify their true specialization.
3. Extract ALL relevant skills and technologies.
4. Build an interview blueprint.
5. Identify interview validation areas.
6. Prepare data for the AI Interview Agent.

IMPORTANT:

Return ONLY valid JSON.
Do not include markdown.
Do not include explanations.
Do not wrap JSON in code fences.

====================================================
STEP 1 - PROFILE CLASSIFICATION
====================================================

Identify the candidate's primary profile based on actual responsibilities and recent experience.

Supported profiles:
- .NET Full Stack Developer
- Java Full Stack Developer
- Java Backend Developer
- Python Backend Developer
- Data Engineer
- Data Analyst
- Healthcare Data Analyst
- QA Automation Engineer
- SDET
- QA Lead
- DevOps Engineer
- Cloud Engineer
- Network Engineer
- Network Security Engineer
- Product Owner
- Product Manager
- Business Analyst
- Bench Sales Recruiter
- IT Recruiter
- NetSuite Consultant
- Salesforce Consultant
- CSV Validation Specialist
- Validation Engineer
- Pharma Quality Assurance
- Regulatory Affairs Specialist
- Healthcare / Clinical
- Sales / Business Development
- Other

STEP 2 - PROFILE RULES

Determine:
- profileType
- subProfile
- interviewTrack

STEP 3 - SKILL EXTRACTION

Extract ALL technologies found anywhere in the resume:
- Summary
- Skills section
- Experience section
- Responsibilities
- Environment section
- Projects
- Tools section

handsOnSkills:
Technologies personally used, developed, configured, administered, tested, designed, implemented or deployed.

domainSkills:
Business/domain expertise such as banking, insurance, healthcare, finance, provider certification, payroll, recruitment, ERP, supply chain, logistics.

technologyDomainsHandled:
Architectures, platforms, enterprise ecosystems, and industry technology domains.
Do NOT put raw technologies here.
Never leave this empty if sufficient information exists.

consultantProfilesMarketed:
Only for Bench Sales Recruiter or IT Recruiter.
For all non-recruitment profiles return [].

tools:
Software tools/platforms such as JIRA, Postman, Git, Jenkins, Azure DevOps, Visual Studio, PyCharm, IntelliJ, Dice, LinkedIn, Monster.

STEP 4 - INTERVIEW PREPARATION

strengths:
Return 5-10 strengths.

weakAreas:
Never return only "Areas to validate in interview".
Generate minimum 5 concrete validation areas.

recommendedInterviewTopics:
Return specific interview topics.

questionCategories:
Generate 8-15 specific categories.
Do not return generic values like "Technical Questions" or "Behavioral Questions".

interviewBlueprint:
Generate weightage percentages.
Total must equal 100.

STEP 5 - INTERVIEW ROUND DECISION

Determine:
- codingRequired
- brokenCodeRound
- systemDesignRound
- sqlRound
- caseStudyRound
- troubleshootingRound
- domainRound

STEP 6 - RETURN EXACT JSON

{
  "profileType": "",
  "subProfile": "",
  "interviewTrack": "",
  "summary": "",
  "seniority": "",
  "experienceYears": 0,
  "handsOnSkills": [],
  "domainSkills": [],
  "technologyDomainsHandled": [],
  "consultantProfilesMarketed": [],
  "tools": [],
  "strengths": [],
  "weakAreas": [],
  "recommendedInterviewTopics": [],
  "interviewBlueprint": {
    "categories": []
  },
  "questionCategories": [],
  "codingRequired": false,
  "brokenCodeRound": false,
  "systemDesignRound": false,
  "sqlRound": false,
  "caseStudyRound": false,
  "troubleshootingRound": false,
  "domainRound": false
}

Resume:
${resume_text}
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
        { error: "OpenAI request failed", details: data },
        { status: aiResponse.status }
      );
    }

    const outputText =
      data.output_text ||
      data.output?.[0]?.content?.find(
        (c: { type: string; text?: string }) => c.type === "output_text"
      )?.text;

    if (!outputText) {
      return NextResponse.json(
        { error: "AI did not return valid output" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(outputText);

    const { data: insertedData, error: dbError } = await supabase
      .from("consultants")
      .insert({
        full_name,
        email,
        phone,
        linkedin_profile,
        resume_text,

        profile_type: parsed.profileType,
        sub_profile: parsed.subProfile,
        interview_track: parsed.interviewTrack,
        seniority: parsed.seniority,
        experience_years: parsed.experienceYears,
        ai_summary: parsed.summary,

        skills: parsed.handsOnSkills || [],
        hands_on_skills: parsed.handsOnSkills || [],
        domain_skills: parsed.domainSkills || [],
        technology_domains_handled: parsed.technologyDomainsHandled || [],
        consultant_profiles_marketed: parsed.consultantProfilesMarketed || [],
        tools: parsed.tools || [],

        strengths: parsed.strengths || [],
        weak_areas: parsed.weakAreas || [],
        recommended_interview_topics:
          parsed.recommendedInterviewTopics || [],

        interview_blueprint: parsed.interviewBlueprint || {},
        question_categories: parsed.questionCategories || [],

        coding_required: parsed.codingRequired || false,
        broken_code_round: parsed.brokenCodeRound || false,
        system_design_round: parsed.systemDesignRound || false,
        sql_round: parsed.sqlRound || false,
        case_study_round: parsed.caseStudyRound || false,
        troubleshooting_round: parsed.troubleshootingRound || false,
        domain_round: parsed.domainRound || false,

        interview_status: "Resume Analyzed",
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json(
        { error: "Database insert failed", details: dbError },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        consultant: insertedData,
        resumeAnalysis: parsed,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}
import { supabaseAdmin } from "@/lib/supabase-admin";


export type Difficulty = "Easy" | "Medium" | "Hard" | "Expert";

export type QuestionType =
  | "Conceptual"
  | "Scenario"
  | "Coding"
  | "Debugging"
  | "Architecture"
  | "Behavioral"
  | "Domain"
  | "SQL"
  | "Tool";

export type QuestionSource =
  | "QUESTION_BANK"
  | "AI_GENERATED"
  | "SYSTEM_GENERATED";

export type CoverageStatus =
  | "Not Started"
  | "In Progress"
  | "Needs Validation"
  | "Sufficiently Covered"
  | "Strongly Validated";

export type ConsultantLike = {
  id?: string;
  profile_type?: string | null;
  seniority?: string | null;
  experience_years?: number | null;
  primary_technical_skills?: unknown;
  secondary_technical_skills?: unknown;
  hands_on_skills?: unknown;
  skills?: unknown;
  professional_skills?: unknown;
  tools?: unknown;
  domain_experience?: unknown;
};

export type ExistingQuestion = {
  id: string;
  question_id: string | null;
  question: string;
  topic: string | null;
  difficulty: string | null;
  question_type: string | null;
  question_source: string | null;
  score: number | null;
  answer_text?: string | null;
};

export type QuestionBankItem = {
  id: string;
  question_text: string;
  profile_type: string | null;
  technology: string | null;
  sub_technology: string | null;
  category: string | null;
  sub_category: string | null;
  difficulty: string | null;
  question_type: string | null;
  expected_answer: string | null;
};

export type GeneratedQuestion = {
  question: string;
  questionType: QuestionType;
  difficulty: Difficulty;
  rationale: string;
};

const DEFAULT_QUESTION_BANK_BLEND_RATIO = 0.65;

export function getQuestionBankBlendRatio(value?: unknown): number {
  const parsed = Number(
    value ?? process.env.QUESTION_BANK_BLEND_RATIO ?? DEFAULT_QUESTION_BANK_BLEND_RATIO
  );

  if (Number.isNaN(parsed)) return DEFAULT_QUESTION_BANK_BLEND_RATIO;

  return Math.min(1, Math.max(0, parsed));
}

export function normalizeStringList(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeStringList(item)).filter(Boolean);
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.name === "string") {
      return [record.name.trim()].filter(Boolean);
    }

    return Object.values(record)
      .flatMap((item) => normalizeStringList(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return [];

    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return normalizeStringList(JSON.parse(trimmed));
      } catch {
        // Continue with delimiter splitting.
      }
    }

    return trimmed
      .split(/[,;\n|]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function uniqueStrings(values: string[]): string[] {
  const unique = new Map<string, string>();

  for (const value of values) {
    const cleaned = value.trim();

    if (!cleaned) continue;

    const key = cleaned.toLowerCase();

    if (!unique.has(key)) {
      unique.set(key, cleaned);
    }
  }

  return Array.from(unique.values());
}

export function isNonCodingProfile(profileType?: string | null): boolean {
  const profile = String(profileType || "").toLowerCase();

  const nonCodingProfiles = [
    "bench sales recruiter",
    "it recruiter",
    "technical recruiter",
    "business analyst",
    "product owner",
    "product manager",
    "sales",
    "business development",
  ];

  return nonCodingProfiles.some((value) => profile.includes(value));
}

export function getInterviewFocusAreas(
  consultant: ConsultantLike,
  requestedSkills?: unknown
): string[] {
  const requested = uniqueStrings(normalizeStringList(requestedSkills));

  if (requested.length > 0) {
    return requested;
  }

  const primaryTechnicalSkills = uniqueStrings(
    normalizeStringList(consultant.primary_technical_skills)
  );

  if (primaryTechnicalSkills.length > 0) {
    return primaryTechnicalSkills;
  }

  const handsOnSkills = uniqueStrings(
    normalizeStringList(consultant.hands_on_skills)
  );

  if (handsOnSkills.length > 0) {
    return handsOnSkills;
  }

  const legacySkills = uniqueStrings(normalizeStringList(consultant.skills));

  if (legacySkills.length > 0) {
    return legacySkills;
  }

  if (isNonCodingProfile(consultant.profile_type)) {
    const professionalSkills = uniqueStrings(
      normalizeStringList(consultant.professional_skills)
    );

    if (professionalSkills.length > 0) {
      return professionalSkills;
    }

    const tools = uniqueStrings(normalizeStringList(consultant.tools));

    if (tools.length > 0) {
      return tools;
    }
  }

  return consultant.profile_type ? [consultant.profile_type] : [];
}

export function getDefaultDifficulty(
  experienceYears?: number | null
): Difficulty {
  const years = Number(experienceYears || 0);

  if (years <= 2) return "Easy";
  if (years <= 5) return "Medium";
  if (years <= 9) return "Hard";

  return "Expert";
}

export function normalizeText(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.\s/-]/gu, " ")
    .replace(/\s+/g, " ");
}

function tokens(value?: string | null): string[] {
  return normalizeText(value)
    .split(/[\s/,-]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function calculateQuestionMatchScore(
  question: QuestionBankItem,
  skill: string,
  difficulty: Difficulty,
  questionType: QuestionType,
  profileType: string
): number {
  const normalizedSkill = normalizeText(skill);
  const normalizedProfile = normalizeText(profileType);
  const normalizedDifficulty = normalizeText(difficulty);
  const normalizedQuestionType = normalizeText(questionType);

  const technology = normalizeText(question.technology);
  const subTechnology = normalizeText(question.sub_technology);
  const category = normalizeText(question.category);
  const subCategory = normalizeText(question.sub_category);
  const questionText = normalizeText(question.question_text);
  const bankProfile = normalizeText(question.profile_type);
  const bankDifficulty = normalizeText(question.difficulty);
  const bankQuestionType = normalizeText(question.question_type);

  let score = 0;

  if (technology === normalizedSkill) score += 18;
  else if (
    technology &&
    (technology.includes(normalizedSkill) ||
      normalizedSkill.includes(technology))
  ) {
    score += 12;
  }

  if (subTechnology === normalizedSkill) score += 16;
  else if (
    subTechnology &&
    (subTechnology.includes(normalizedSkill) ||
      normalizedSkill.includes(subTechnology))
  ) {
    score += 10;
  }

  if (
    normalizedSkill &&
    (category.includes(normalizedSkill) ||
      subCategory.includes(normalizedSkill))
  ) {
    score += 8;
  }

  const skillTokens = new Set(tokens(skill));
  const searchableTokens = new Set(
    tokens(
      [
        question.technology,
        question.sub_technology,
        question.category,
        question.sub_category,
        question.question_text,
      ]
        .filter(Boolean)
        .join(" ")
    )
  );

  let overlap = 0;

  for (const token of skillTokens) {
    if (searchableTokens.has(token)) {
      overlap += 1;
    }
  }

  score += Math.min(10, overlap * 2);

  if (
    normalizedProfile &&
    bankProfile &&
    (bankProfile === normalizedProfile ||
      bankProfile.includes(normalizedProfile) ||
      normalizedProfile.includes(bankProfile))
  ) {
    score += 7;
  }

  if (bankDifficulty === normalizedDifficulty) {
    score += 4;
  }

  if (bankQuestionType === normalizedQuestionType) {
    score += 3;
  }

  if (questionText.includes(normalizedSkill)) {
    score += 5;
  }

  return score;
}

export async function loadApprovedQuestionBank(): Promise<QuestionBankItem[]> {
  const { data, error } = await supabaseAdmin
    .from("question_bank")
    .select(`
      id,
      question_text,
      profile_type,
      technology,
      sub_technology,
      category,
      sub_category,
      difficulty,
      question_type,
      expected_answer
    `)
    .eq("is_active", true)
    .eq("review_status", "Approved")
    .range(0, 4999);

  if (error) {
    throw error;
  }

  return (data || []) as QuestionBankItem[];
}

export function findQuestionBankQuestion({
  questionBank,
  skill,
  difficulty,
  questionType,
  profileType,
  existingQuestions,
}: {
  questionBank: QuestionBankItem[];
  skill: string;
  difficulty: Difficulty;
  questionType: QuestionType;
  profileType: string;
  existingQuestions: ExistingQuestion[];
}): QuestionBankItem | null {
  const usedIds = new Set(
    existingQuestions
      .map((item) => item.question_id)
      .filter((id): id is string => Boolean(id))
  );

  const usedTexts = new Set(
    existingQuestions.map((item) => normalizeText(item.question))
  );

  const ranked = questionBank
    .filter((question) => {
      if (usedIds.has(question.id)) return false;

      return !usedTexts.has(normalizeText(question.question_text));
    })
    .map((question) => ({
      question,
      score: calculateQuestionMatchScore(
        question,
        skill,
        difficulty,
        questionType,
        profileType
      ),
    }))
    .filter((item) => item.score >= 6)
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0) return null;

  const strongest = ranked.slice(0, 5);
  const selected = Math.floor(Math.random() * strongest.length);

  return strongest[selected].question;
}

export function getOpenAIOutputText(data: any): string {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  for (const outputItem of data?.output || []) {
    for (const contentItem of outputItem?.content || []) {
      if (
        contentItem?.type === "output_text" &&
        typeof contentItem?.text === "string"
      ) {
        return contentItem.text;
      }
    }
  }

  return "";
}

export async function generateQuestionForSkill({
  consultant,
  skill,
  difficulty,
  domainContext,
  previousQuestions,
  purpose,
}: {
  consultant: ConsultantLike;
  skill: string;
  difficulty: Difficulty;
  domainContext: string[];
  previousQuestions: string[];
  purpose: string;
}): Promise<GeneratedQuestion | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const prompt = `
You are a senior adaptive interviewer.

Generate one new interview question.

Candidate profile:
${consultant.profile_type || "Not provided"}

Seniority:
${consultant.seniority || "Not provided"}

Experience:
${consultant.experience_years || 0} years

Technical or professional focus area:
${skill}

Required difficulty:
${difficulty}

Reason for this question:
${purpose}

Previously asked questions:
${JSON.stringify(previousQuestions)}

Domain context:
${JSON.stringify(domainContext)}

Rules:
- The question must primarily evaluate "${skill}".
- Do not repeat or lightly rephrase a previous question.
- Domain experience is context only.
- Do not ask standalone business-domain questions.
- For senior candidates, prefer practical, debugging, production,
  performance, security, architecture, or trade-off scenarios.
- Do not generate a coding question for a non-coding profile.
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_INTERVIEW_MODEL || "gpt-4o-mini",
      input: prompt,
      max_output_tokens: 700,
      text: {
        format: {
          type: "json_schema",
          name: "generated_interview_question",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              question: { type: "string" },
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
              difficulty: {
                type: "string",
                enum: ["Easy", "Medium", "Hard", "Expert"],
              },
              rationale: { type: "string" },
            },
            required: [
              "question",
              "questionType",
              "difficulty",
              "rationale",
            ],
          },
        },
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("AI question generation failed:", data);
    return null;
  }

  const outputText = getOpenAIOutputText(data);

  if (!outputText) return null;

  return JSON.parse(outputText) as GeneratedQuestion;
}

export function createFallbackQuestion(
  skill: string,
  difficulty: Difficulty
): GeneratedQuestion {
  if (difficulty === "Expert") {
    return {
      question: `Describe a complex production problem you solved using ${skill}. Explain the architecture, trade-offs, performance, security, and final outcome.`,
      questionType: "Architecture",
      difficulty,
      rationale: "Expert production scenario fallback",
    };
  }

  if (difficulty === "Hard") {
    return {
      question: `How would you design and troubleshoot a production-ready solution using ${skill}? Include performance, testing, and error handling.`,
      questionType: "Scenario",
      difficulty,
      rationale: "Hard practical scenario fallback",
    };
  }

  if (difficulty === "Medium") {
    return {
      question: `Explain how you used ${skill} in a real project, the problem it solved, and the implementation decisions you made.`,
      questionType: "Scenario",
      difficulty,
      rationale: "Medium real-project fallback",
    };
  }

  return {
    question: `Explain the fundamental concepts of ${skill} and give a simple practical example.`,
    questionType: "Conceptual",
    difficulty,
    rationale: "Easy foundational fallback",
  };
}

export function shouldUseQuestionBank({
  existingQuestions,
  skill,
  bankAvailable,
  aiAvailable,
  targetRatio,
}: {
  existingQuestions: ExistingQuestion[];
  skill: string;
  bankAvailable: boolean;
  aiAvailable: boolean;
  targetRatio: number;
}): boolean {
  if (!bankAvailable) return false;
  if (!aiAvailable) return true;

  const skillQuestions = existingQuestions.filter(
    (item) => normalizeText(item.topic) === normalizeText(skill)
  );

  const lastTwoSources = skillQuestions
    .slice(-2)
    .map((item) => item.question_source);

  if (
    lastTwoSources.length === 2 &&
    lastTwoSources.every((source) => source === "QUESTION_BANK")
  ) {
    return false;
  }

  if (
    lastTwoSources.length === 2 &&
    lastTwoSources.every((source) => source === "AI_GENERATED")
  ) {
    return true;
  }

  const bankCount = skillQuestions.filter(
    (item) => item.question_source === "QUESTION_BANK"
  ).length;

  const aiCount = skillQuestions.filter(
    (item) =>
      item.question_source === "AI_GENERATED" ||
      item.question_source === "SYSTEM_GENERATED"
  ).length;

  const total = bankCount + aiCount;

  if (total === 0) {
    return Math.random() < targetRatio;
  }

  return bankCount / total < targetRatio;
}

export function isCovered(status?: string | null): boolean {
  return (
    status === "Sufficiently Covered" ||
    status === "Strongly Validated"
  );
}

export function chooseNextUncoveredSkill(
  skills: string[],
  assessments: {
    skill_name: string;
    coverage_status: string | null;
  }[],
  currentSkill: string
): string | null {
  const assessmentMap = new Map(
    assessments.map((assessment) => [
      normalizeText(assessment.skill_name),
      assessment,
    ])
  );

  const notStarted = skills.find((skill) => {
    if (normalizeText(skill) === normalizeText(currentSkill)) {
      return false;
    }

    const assessment = assessmentMap.get(normalizeText(skill));

    return !assessment || assessment.coverage_status === "Not Started";
  });

  if (notStarted) return notStarted;

  return (
    skills.find((skill) => {
      if (normalizeText(skill) === normalizeText(currentSkill)) {
        return false;
      }

      const assessment = assessmentMap.get(normalizeText(skill));

      return !isCovered(assessment?.coverage_status);
    }) || null
  );
}

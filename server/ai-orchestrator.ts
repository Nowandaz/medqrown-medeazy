import OpenAI from "openai";
import { storage } from "./storage";
import { batchProcess } from "./replit_integrations/batch";
import type { AiProvider, ExamResponse, Question, Subquestion } from "@shared/schema";

interface MarkingItem {
  responseId: number;
  questionContent: string;
  expectedAnswer: string;
  studentAnswer: string;
  marks: number;
  imageCaption?: string | null;
}

interface MarkingResult {
  responseId: number;
  isCorrect: boolean;
  marksAwarded: number;
  feedback: string;
}

function getAiClient(provider: AiProvider): OpenAI {
  const endpoint = provider.endpoint || (provider.baseUrlEnv ? process.env[provider.baseUrlEnv] : undefined);
  const apiKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : "";
  return new OpenAI({ apiKey: apiKey || "dummy", baseURL: endpoint });
}

function getModelName(provider: AiProvider): string {
  if (provider.model) return provider.model;
  switch (provider.type) {
    case "openai": return "gpt-4o";
    case "gemini": return "gemini-2.0-flash";
    case "anthropic": return "claude-sonnet-4-20250514";
    default: return "gpt-4o";
  }
}

function selectProvider(providers: AiProvider[], index: number): AiProvider {
  const totalWeight = providers.reduce((sum, p) => sum + p.weight, 0);
  let weightedIndex = index % totalWeight;
  for (const provider of providers) {
    if (weightedIndex < provider.weight) return provider;
    weightedIndex -= provider.weight;
  }
  return providers[0];
}

export async function markSAQResponses(
  examId: number,
  customPrompt?: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{ jobId: number; results: MarkingResult[] }> {
  const providers = (await storage.getAiProviders()).filter(p => p.isActive);
  if (providers.length === 0) {
    providers.push({
      id: 0,
      name: "OpenAI (Default)",
      type: "openai",
      apiKeyEnv: "AI_INTEGRATIONS_OPENAI_API_KEY",
      baseUrlEnv: "AI_INTEGRATIONS_OPENAI_BASE_URL",
      endpoint: null,
      model: null,
      isActive: true,
      weight: 1,
    });
  }

  const questions = await storage.getQuestionsByExam(examId);
  const saqQuestions = questions.filter(q => q.type === "saq");

  const items: MarkingItem[] = [];
  for (const q of saqQuestions) {
    if (q.hasSubquestions) {
      const subs = await storage.getSubquestions(q.id);
      for (const sq of subs) {
        const allResponses = await getAllResponsesForQuestion(q.id, sq.id);
        for (const resp of allResponses) {
          if (resp.answer && resp.isCorrect === null) {
            items.push({
              responseId: resp.id,
              questionContent: `${q.content}\n${sq.content}`,
              expectedAnswer: sq.expectedAnswer || "",
              studentAnswer: resp.answer,
              marks: sq.marks,
              imageCaption: q.imageCaption,
            });
          }
        }
      }
    } else {
      const allResponses = await getAllResponsesForQuestion(q.id);
      for (const resp of allResponses) {
        if (resp.answer && resp.isCorrect === null) {
          items.push({
            responseId: resp.id,
            questionContent: q.content,
            expectedAnswer: q.expectedAnswer || "",
            studentAnswer: resp.answer,
            marks: q.marks,
            imageCaption: q.imageCaption,
          });
        }
      }
    }
  }

  const job = await storage.createAiMarkingJob({
    examId,
    totalItems: items.length,
    prompt: customPrompt,
  });

  const defaultPrompt = customPrompt || `You are marking a medical exam short answer question. Compare the student's answer to the expected answer.

Rules:
- Be strict but fair in your evaluation.
- Accept synonyms, abbreviations, alternative spellings, and similar phrasing that conveys the same meaning as the expected answer.
- Minor spelling mistakes should not count against the student if the intended answer is clearly correct.
- If the student's answer is INCORRECT, your feedback MUST explain why the expected answer is the correct one — provide a brief educational explanation.
- If the student's answer is CORRECT, give brief positive feedback.
- NEVER mention "image description", "image caption", "based on the image", or any reference to images/descriptions in your feedback. Write as if you inherently know the subject matter.

Respond in JSON format: {"isCorrect": true/false, "feedback": "your feedback"}`;

  let completed = 0;
  const results = await batchProcess(
    items,
    async (item, index) => {
      const provider = selectProvider(providers, index);
      const client = getAiClient(provider);
      const model = getModelName(provider);

      let userContent = `Question: ${item.questionContent}\nExpected Answer: ${item.expectedAnswer}\nStudent Answer: ${item.studentAnswer}`;
      if (item.imageCaption) {
        userContent += `\nAdditional context: ${item.imageCaption}`;
      }

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: defaultPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || "{}";
      let parsed: { isCorrect: boolean; feedback: string };
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { isCorrect: false, feedback: "Unable to parse AI response" };
      }

      const marksAwarded = parsed.isCorrect ? item.marks : 0;

      await storage.updateResponse(item.responseId, {
        isCorrect: parsed.isCorrect,
        aiFeedback: parsed.feedback,
        marksAwarded,
      });

      completed++;
      await storage.updateAiMarkingJob(job.id, { completedItems: completed });
      onProgress?.(completed, items.length);

      return {
        responseId: item.responseId,
        isCorrect: parsed.isCorrect,
        marksAwarded,
        feedback: parsed.feedback,
      };
    },
    { concurrency: 2, retries: 5 }
  );

  await storage.updateAiMarkingJob(job.id, { status: "completed", completedItems: items.length });
  return { jobId: job.id, results };
}

export async function markSingleResponse(
  responseId: number,
  customPrompt?: string
): Promise<MarkingResult> {
  const providers = (await storage.getAiProviders()).filter(p => p.isActive);
  if (providers.length === 0) throw new Error("No active AI providers");

  const provider = providers[0];
  const client = getAiClient(provider);
  const model = getModelName(provider);

  const { db } = await import("./db");
  const { responses, questions, subquestions: subqTable } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");

  const [resp] = await db.select().from(responses).where(eq(responses.id, responseId));
  if (!resp || !resp.answer) throw new Error("Response not found or empty");

  const [question] = await db.select().from(questions).where(eq(questions.id, resp.questionId));
  if (!question) throw new Error("Question not found");

  let expectedAnswer = question.expectedAnswer || "";
  let questionContent = question.content;

  if (resp.subquestionId) {
    const [sq] = await db.select().from(subqTable).where(eq(subqTable.id, resp.subquestionId));
    if (sq) {
      questionContent = `${question.content}\n${sq.content}`;
      expectedAnswer = sq.expectedAnswer || "";
    }
  }

  const prompt = customPrompt || `You are marking a medical exam short answer question. Compare the student's answer to the expected answer.

Rules:
- Be strict but fair in your evaluation.
- Accept synonyms, abbreviations, alternative spellings, and similar phrasing that conveys the same meaning as the expected answer.
- Minor spelling mistakes should not count against the student if the intended answer is clearly correct.
- If the student's answer is INCORRECT, your feedback MUST explain why the expected answer is the correct one — provide a brief educational explanation.
- If the student's answer is CORRECT, give brief positive feedback.
- NEVER mention "image description", "image caption", "based on the image", "the image shows", or any reference to images/descriptions in your feedback. Write as if you inherently know the subject matter.

Respond in JSON format: {"isCorrect": true/false, "feedback": "your feedback"}`;

  let userContent = `Question: ${questionContent}\nExpected Answer: ${expectedAnswer}\nStudent Answer: ${resp.answer}`;
  if (question.type === "saq" && question.imageCaption) {
    userContent += `\nAdditional context: ${question.imageCaption}`;
  }

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content || "{}";
  let parsed: { isCorrect: boolean; feedback: string };
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { isCorrect: false, feedback: "Unable to parse AI response" };
  }

  const marks = resp.subquestionId
    ? (await db.select().from(subqTable).where(eq(subqTable.id, resp.subquestionId)))[0]?.marks || 1
    : question.marks;

  const marksAwarded = parsed.isCorrect ? marks : 0;

  await storage.updateResponse(responseId, {
    isCorrect: parsed.isCorrect,
    aiFeedback: parsed.feedback,
    marksAwarded,
  });

  return {
    responseId,
    isCorrect: parsed.isCorrect,
    marksAwarded,
    feedback: parsed.feedback,
  };
}

async function getAllResponsesForQuestion(questionId: number, subquestionId?: number): Promise<ExamResponse[]> {
  const { db } = await import("./db");
  const { responses } = await import("@shared/schema");
  const { eq, and } = await import("drizzle-orm");

  const conditions = [eq(responses.questionId, questionId)];
  if (subquestionId) {
    conditions.push(eq(responses.subquestionId, subquestionId));
  }

  return db.select().from(responses).where(and(...conditions));
}

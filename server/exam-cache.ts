import { storage } from "./storage";
import type { Question, QuestionOption, Subquestion } from "@shared/schema";

interface CachedExamStructure {
  questions: Question[];
  optionsByQuestion: Map<number, QuestionOption[]>;
  subsByQuestion: Map<number, Subquestion[]>;
  maxScore: number;
  timestamp: number;
}

const cache = new Map<number, CachedExamStructure>();
const CACHE_TTL = 5 * 60 * 1000;

export async function getExamStructure(examId: number): Promise<CachedExamStructure> {
  const cached = cache.get(examId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }

  const questions = await storage.getQuestionsByExam(examId);
  const optionsByQuestion = new Map<number, QuestionOption[]>();
  const subsByQuestion = new Map<number, Subquestion[]>();
  let maxScore = 0;

  await Promise.all(questions.map(async (q) => {
    if (q.type === "mcq") {
      const opts = await storage.getQuestionOptions(q.id);
      optionsByQuestion.set(q.id, opts);
    }
    if (q.hasSubquestions) {
      const subs = await storage.getSubquestions(q.id);
      subsByQuestion.set(q.id, subs);
      maxScore += subs.reduce((s, sq) => s + sq.marks, 0);
    } else {
      maxScore += q.marks;
    }
  }));

  const structure: CachedExamStructure = {
    questions,
    optionsByQuestion,
    subsByQuestion,
    maxScore,
    timestamp: Date.now(),
  };

  cache.set(examId, structure);
  return structure;
}

export function invalidateExamCache(examId: number) {
  cache.delete(examId);
}

export function clearExamCache() {
  cache.clear();
}

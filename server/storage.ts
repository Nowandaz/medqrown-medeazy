import { db } from "./db";
import { eq, and, desc, asc, sql, count } from "drizzle-orm";
import {
  admins, exams, students, examStudents, questions, questionOptions,
  subquestions, attempts, responses, aiProviders, emailTemplates,
  emailLogs, studentFeedback, auditLogs, aiMarkingJobs,
  type Admin, type InsertAdmin, type Exam, type InsertExam,
  type Student, type InsertStudent, type ExamStudent, type InsertExamStudent,
  type Question, type InsertQuestion, type QuestionOption, type InsertQuestionOption,
  type Subquestion, type InsertSubquestion, type Attempt, type InsertAttempt,
  type ExamResponse, type InsertResponse, type AiProvider, type InsertAiProvider,
  type EmailTemplate, type InsertEmailTemplate, type StudentFeedbackType,
  type InsertStudentFeedback, type AuditLog, type AiMarkingJob,
} from "@shared/schema";

export interface IStorage {
  getAdmin(id: number): Promise<Admin | undefined>;
  getAdminByEmail(email: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  updateAdminPassword(id: number, passwordHash: string): Promise<void>;
  getAllAdmins(): Promise<Admin[]>;

  getExam(id: number): Promise<Exam | undefined>;
  getAllExams(): Promise<Exam[]>;
  createExam(exam: InsertExam): Promise<Exam>;
  updateExam(id: number, data: Partial<InsertExam>): Promise<Exam>;
  deleteExam(id: number): Promise<void>;

  getStudent(id: number): Promise<Student | undefined>;
  getStudentByEmail(email: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  getStudentsByExam(examId: number): Promise<(ExamStudent & { student: Student })[]>;

  getExamStudent(id: number): Promise<ExamStudent | undefined>;
  getExamStudentByCredentials(examId: number, email: string, password: string): Promise<(ExamStudent & { student: Student }) | undefined>;
  createExamStudent(es: InsertExamStudent): Promise<ExamStudent>;
  updateExamStudent(id: number, data: Partial<ExamStudent>): Promise<void>;
  deleteExamStudent(id: number): Promise<void>;
  getExamStudentByExamAndStudent(examId: number, studentId: number): Promise<ExamStudent | undefined>;

  getQuestion(id: number): Promise<Question | undefined>;
  getQuestionsByExam(examId: number): Promise<Question[]>;
  createQuestion(q: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, data: Partial<InsertQuestion>): Promise<Question>;
  deleteQuestion(id: number): Promise<void>;

  getQuestionOptions(questionId: number): Promise<QuestionOption[]>;
  createQuestionOption(opt: InsertQuestionOption): Promise<QuestionOption>;
  deleteQuestionOptions(questionId: number): Promise<void>;

  getSubquestions(questionId: number): Promise<Subquestion[]>;
  createSubquestion(sq: InsertSubquestion): Promise<Subquestion>;
  deleteSubquestions(questionId: number): Promise<void>;

  getAttempt(id: number): Promise<Attempt | undefined>;
  getAttemptByExamStudent(examStudentId: number): Promise<Attempt | undefined>;
  createAttempt(a: InsertAttempt): Promise<Attempt>;
  updateAttempt(id: number, data: Partial<Attempt>): Promise<void>;
  resetAttempt(examStudentId: number): Promise<void>;

  getResponse(attemptId: number, questionId: number, subquestionId?: number | null): Promise<ExamResponse | undefined>;
  getResponsesByAttempt(attemptId: number): Promise<ExamResponse[]>;
  upsertResponse(r: InsertResponse): Promise<ExamResponse>;
  updateResponse(id: number, data: Partial<ExamResponse>): Promise<void>;

  getAiProviders(): Promise<AiProvider[]>;
  createAiProvider(p: InsertAiProvider): Promise<AiProvider>;
  updateAiProvider(id: number, data: Partial<AiProvider>): Promise<void>;
  deleteAiProvider(id: number): Promise<void>;

  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(id: number): Promise<EmailTemplate | undefined>;
  createEmailTemplate(t: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: number, data: Partial<InsertEmailTemplate>): Promise<void>;

  createEmailLog(log: { templateId?: number; recipientEmail: string; subject: string; status: string }): Promise<void>;

  getStudentFeedback(examId: number): Promise<StudentFeedbackType[]>;
  createStudentFeedback(fb: InsertStudentFeedback): Promise<StudentFeedbackType>;

  createAuditLog(log: { adminId?: number; action: string; details?: string }): Promise<void>;

  getAiMarkingJob(id: number): Promise<AiMarkingJob | undefined>;
  getAiMarkingJobsByExam(examId: number): Promise<AiMarkingJob[]>;
  createAiMarkingJob(job: { examId: number; totalItems: number; prompt?: string }): Promise<AiMarkingJob>;
  updateAiMarkingJob(id: number, data: Partial<AiMarkingJob>): Promise<void>;

  getExamStats(examId: number): Promise<{ total: number; submitted: number; inProgress: number; notStarted: number }>;
  getExamRankings(examId: number): Promise<{ studentName: string; studentEmail: string; totalScore: number; maxScore: number; percentage: number }[]>;
  getQuestionAnalytics(examId: number): Promise<{ questionId: number; content: string; type: string; totalAttempts: number; correctCount: number; avgMarks: number }[]>;
}

export class DatabaseStorage implements IStorage {
  async getAdmin(id: number) {
    const [admin] = await db.select().from(admins).where(eq(admins.id, id));
    return admin;
  }

  async getAdminByEmail(email: string) {
    const [admin] = await db.select().from(admins).where(eq(admins.email, email));
    return admin;
  }

  async createAdmin(admin: InsertAdmin) {
    const [created] = await db.insert(admins).values(admin).returning();
    return created;
  }

  async updateAdminPassword(id: number, passwordHash: string) {
    await db.update(admins).set({ passwordHash }).where(eq(admins.id, id));
  }

  async getAllAdmins() {
    return db.select().from(admins).orderBy(admins.name);
  }

  async getExam(id: number) {
    const [exam] = await db.select().from(exams).where(eq(exams.id, id));
    return exam;
  }

  async getAllExams() {
    return db.select().from(exams).orderBy(desc(exams.createdAt));
  }

  async createExam(exam: InsertExam) {
    const [created] = await db.insert(exams).values(exam).returning();
    return created;
  }

  async updateExam(id: number, data: Partial<InsertExam>) {
    const [updated] = await db.update(exams).set(data).where(eq(exams.id, id)).returning();
    return updated;
  }

  async deleteExam(id: number) {
    await db.delete(exams).where(eq(exams.id, id));
  }

  async getStudent(id: number) {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student;
  }

  async getStudentByEmail(email: string) {
    const [student] = await db.select().from(students).where(eq(students.email, email));
    return student;
  }

  async createStudent(student: InsertStudent) {
    const [created] = await db.insert(students).values(student).returning();
    return created;
  }

  async getStudentsByExam(examId: number) {
    const result = await db
      .select()
      .from(examStudents)
      .innerJoin(students, eq(examStudents.studentId, students.id))
      .where(eq(examStudents.examId, examId))
      .orderBy(desc(examStudents.createdAt));
    return result.map(r => ({ ...r.exam_students, student: r.students }));
  }

  async getExamStudent(id: number) {
    const [es] = await db.select().from(examStudents).where(eq(examStudents.id, id));
    return es;
  }

  async getExamStudentByCredentials(examId: number, email: string, password: string) {
    const result = await db
      .select()
      .from(examStudents)
      .innerJoin(students, eq(examStudents.studentId, students.id))
      .where(and(eq(examStudents.examId, examId), eq(students.email, email), eq(examStudents.password, password)));
    if (result.length === 0) return undefined;
    return { ...result[0].exam_students, student: result[0].students };
  }

  async createExamStudent(es: InsertExamStudent) {
    const [created] = await db.insert(examStudents).values(es).returning();
    return created;
  }

  async updateExamStudent(id: number, data: Partial<ExamStudent>) {
    await db.update(examStudents).set(data).where(eq(examStudents.id, id));
  }

  async deleteExamStudent(id: number) {
    await db.delete(examStudents).where(eq(examStudents.id, id));
  }

  async getExamStudentByExamAndStudent(examId: number, studentId: number) {
    const [es] = await db.select().from(examStudents).where(and(eq(examStudents.examId, examId), eq(examStudents.studentId, studentId)));
    return es;
  }

  async getQuestion(id: number) {
    const [q] = await db.select().from(questions).where(eq(questions.id, id));
    return q;
  }

  async getQuestionsByExam(examId: number) {
    return db.select().from(questions).where(eq(questions.examId, examId)).orderBy(asc(questions.orderIndex));
  }

  async createQuestion(q: InsertQuestion) {
    const [created] = await db.insert(questions).values(q).returning();
    return created;
  }

  async updateQuestion(id: number, data: Partial<InsertQuestion>) {
    const [updated] = await db.update(questions).set(data).where(eq(questions.id, id)).returning();
    return updated;
  }

  async deleteQuestion(id: number) {
    await db.delete(questions).where(eq(questions.id, id));
  }

  async getQuestionOptions(questionId: number) {
    return db.select().from(questionOptions).where(eq(questionOptions.questionId, questionId)).orderBy(asc(questionOptions.orderIndex));
  }

  async createQuestionOption(opt: InsertQuestionOption) {
    const [created] = await db.insert(questionOptions).values(opt).returning();
    return created;
  }

  async deleteQuestionOptions(questionId: number) {
    await db.delete(questionOptions).where(eq(questionOptions.questionId, questionId));
  }

  async getSubquestions(questionId: number) {
    return db.select().from(subquestions).where(eq(subquestions.questionId, questionId)).orderBy(asc(subquestions.orderIndex));
  }

  async createSubquestion(sq: InsertSubquestion) {
    const [created] = await db.insert(subquestions).values(sq).returning();
    return created;
  }

  async deleteSubquestions(questionId: number) {
    await db.delete(subquestions).where(eq(subquestions.questionId, questionId));
  }

  async getAttempt(id: number) {
    const [a] = await db.select().from(attempts).where(eq(attempts.id, id));
    return a;
  }

  async getAttemptByExamStudent(examStudentId: number) {
    const [a] = await db.select().from(attempts).where(eq(attempts.examStudentId, examStudentId)).orderBy(desc(attempts.startedAt));
    return a;
  }

  async createAttempt(a: InsertAttempt) {
    const [created] = await db.insert(attempts).values(a).returning();
    return created;
  }

  async updateAttempt(id: number, data: Partial<Attempt>) {
    await db.update(attempts).set(data).where(eq(attempts.id, id));
  }

  async resetAttempt(examStudentId: number) {
    const attempt = await this.getAttemptByExamStudent(examStudentId);
    if (attempt) {
      await db.delete(responses).where(eq(responses.attemptId, attempt.id));
      await db.delete(attempts).where(eq(attempts.id, attempt.id));
    }
    await db.update(examStudents).set({
      attemptStatus: "not_started",
      resetCount: sql`${examStudents.resetCount} + 1`
    }).where(eq(examStudents.id, examStudentId));
  }

  async getResponse(attemptId: number, questionId: number, subquestionId?: number | null) {
    const conditions = [eq(responses.attemptId, attemptId), eq(responses.questionId, questionId)];
    if (subquestionId) {
      conditions.push(eq(responses.subquestionId, subquestionId));
    }
    const [r] = await db.select().from(responses).where(and(...conditions));
    return r;
  }

  async getResponsesByAttempt(attemptId: number) {
    return db.select().from(responses).where(eq(responses.attemptId, attemptId));
  }

  async upsertResponse(r: InsertResponse) {
    const conditions = [eq(responses.attemptId, r.attemptId), eq(responses.questionId, r.questionId)];
    if (r.subquestionId) {
      conditions.push(eq(responses.subquestionId, r.subquestionId));
    } else {
      conditions.push(sql`${responses.subquestionId} IS NULL`);
    }
    const existing = await db.select().from(responses).where(and(...conditions));
    if (existing.length > 0) {
      const [updated] = await db.update(responses)
        .set({ answer: r.answer })
        .where(eq(responses.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(responses).values(r).returning();
    return created;
  }

  async updateResponse(id: number, data: Partial<ExamResponse>) {
    await db.update(responses).set(data).where(eq(responses.id, id));
  }

  async getAiProviders() {
    return db.select().from(aiProviders).orderBy(aiProviders.name);
  }

  async createAiProvider(p: InsertAiProvider) {
    const [created] = await db.insert(aiProviders).values(p).returning();
    return created;
  }

  async updateAiProvider(id: number, data: Partial<AiProvider>) {
    await db.update(aiProviders).set(data).where(eq(aiProviders.id, id));
  }

  async deleteAiProvider(id: number) {
    await db.delete(aiProviders).where(eq(aiProviders.id, id));
  }

  async getEmailTemplates() {
    return db.select().from(emailTemplates).orderBy(desc(emailTemplates.createdAt));
  }

  async getEmailTemplate(id: number) {
    const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    return t;
  }

  async createEmailTemplate(t: InsertEmailTemplate) {
    const [created] = await db.insert(emailTemplates).values(t).returning();
    return created;
  }

  async updateEmailTemplate(id: number, data: Partial<InsertEmailTemplate>) {
    await db.update(emailTemplates).set(data).where(eq(emailTemplates.id, id));
  }

  async createEmailLog(log: { templateId?: number; recipientEmail: string; subject: string; status: string }) {
    await db.insert(emailLogs).values(log);
  }

  async getStudentFeedback(examId: number) {
    return db.select().from(studentFeedback).where(eq(studentFeedback.examId, examId)).orderBy(desc(studentFeedback.createdAt));
  }

  async createStudentFeedback(fb: InsertStudentFeedback) {
    const [created] = await db.insert(studentFeedback).values(fb).returning();
    return created;
  }

  async createAuditLog(log: { adminId?: number; action: string; details?: string }) {
    await db.insert(auditLogs).values(log);
  }

  async getAiMarkingJob(id: number) {
    const [job] = await db.select().from(aiMarkingJobs).where(eq(aiMarkingJobs.id, id));
    return job;
  }

  async getAiMarkingJobsByExam(examId: number) {
    return db.select().from(aiMarkingJobs).where(eq(aiMarkingJobs.examId, examId)).orderBy(desc(aiMarkingJobs.createdAt));
  }

  async createAiMarkingJob(job: { examId: number; totalItems: number; prompt?: string }) {
    const [created] = await db.insert(aiMarkingJobs).values(job).returning();
    return created;
  }

  async updateAiMarkingJob(id: number, data: Partial<AiMarkingJob>) {
    await db.update(aiMarkingJobs).set(data).where(eq(aiMarkingJobs.id, id));
  }

  async getExamStats(examId: number) {
    const allStudents = await db.select().from(examStudents).where(eq(examStudents.examId, examId));
    const total = allStudents.length;
    const submitted = allStudents.filter(s => s.attemptStatus === "submitted").length;
    const inProgress = allStudents.filter(s => s.attemptStatus === "in_progress").length;
    const notStarted = allStudents.filter(s => s.attemptStatus === "not_started").length;
    return { total, submitted, inProgress, notStarted };
  }

  async getExamRankings(examId: number) {
    const examStudentsList = await db
      .select()
      .from(examStudents)
      .innerJoin(students, eq(examStudents.studentId, students.id))
      .where(and(eq(examStudents.examId, examId), eq(examStudents.attemptStatus, "submitted")));

    const rankings = [];
    for (const es of examStudentsList) {
      const attempt = await this.getAttemptByExamStudent(es.exam_students.id);
      if (!attempt) continue;
      const resps = await this.getResponsesByAttempt(attempt.id);
      const totalScore = resps.reduce((sum, r) => sum + (r.marksAwarded || 0), 0);
      const qs = await this.getQuestionsByExam(examId);
      let maxScore = 0;
      for (const q of qs) {
        if (q.hasSubquestions) {
          const subs = await this.getSubquestions(q.id);
          maxScore += subs.reduce((s, sq) => s + sq.marks, 0);
        } else {
          maxScore += q.marks;
        }
      }
      rankings.push({
        studentName: es.students.name,
        studentEmail: es.students.email,
        totalScore,
        maxScore,
        percentage: maxScore > 0 ? (totalScore / maxScore) * 100 : 0,
      });
    }
    return rankings.sort((a, b) => b.percentage - a.percentage);
  }

  async getQuestionAnalytics(examId: number) {
    const qs = await this.getQuestionsByExam(examId);
    const analytics = [];
    for (const q of qs) {
      const allResponses = await db
        .select()
        .from(responses)
        .where(eq(responses.questionId, q.id));
      const totalAttempts = allResponses.length;
      const correctCount = allResponses.filter(r => r.isCorrect === true).length;
      const avgMarks = totalAttempts > 0
        ? allResponses.reduce((sum, r) => sum + (r.marksAwarded || 0), 0) / totalAttempts
        : 0;
      analytics.push({
        questionId: q.id,
        content: q.content,
        type: q.type,
        totalAttempts,
        correctCount,
        avgMarks,
      });
    }
    return analytics;
  }
}

export const storage = new DatabaseStorage();

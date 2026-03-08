import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, boolean, timestamp, jsonb, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("examiner"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  timerMode: text("timer_mode").notNull().default("none"),
  perQuestionSeconds: integer("per_question_seconds"),
  fullExamSeconds: integer("full_exam_seconds"),
  createdBy: integer("created_by").references(() => admins.id),
  resultsReleased: boolean("results_released").notNull().default(false),
  autoMarkEnabled: boolean("auto_mark_enabled").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const examStudents = pgTable("exam_students", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull().references(() => exams.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  password: text("password").notNull(),
  attemptStatus: text("attempt_status").notNull().default("not_started"),
  resetCount: integer("reset_count").notNull().default(0),
  emailSent: boolean("email_sent").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_exam_students_exam_id").on(table.examId),
  index("idx_exam_students_student_id").on(table.studentId),
]);

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull().references(() => exams.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  content: text("content").notNull(),
  orderIndex: integer("order_index").notNull(),
  marks: integer("marks").notNull().default(1),
  expectedAnswer: text("expected_answer"),
  imageUrl: text("image_url"),
  imageCaption: text("image_caption"),
  hasSubquestions: boolean("has_subquestions").notNull().default(false),
}, (table) => [
  index("idx_questions_exam_id").on(table.examId),
]);

export const questionOptions = pgTable("question_options", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  orderIndex: integer("order_index").notNull(),
}, (table) => [
  index("idx_question_options_question_id").on(table.questionId),
]);

export const subquestions = pgTable("subquestions", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  marks: integer("marks").notNull().default(1),
  expectedAnswer: text("expected_answer"),
  orderIndex: integer("order_index").notNull(),
}, (table) => [
  index("idx_subquestions_question_id").on(table.questionId),
]);

export const attempts = pgTable("attempts", {
  id: serial("id").primaryKey(),
  examStudentId: integer("exam_student_id").notNull().references(() => examStudents.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("in_progress"),
  currentQuestionIndex: integer("current_question_index").notNull().default(0),
  remainingTime: integer("remaining_time"),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  submittedAt: timestamp("submitted_at"),
}, (table) => [
  index("idx_attempts_exam_student_id").on(table.examStudentId),
]);

export const responses = pgTable("responses", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").notNull().references(() => attempts.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => questions.id),
  subquestionId: integer("subquestion_id").references(() => subquestions.id),
  answer: text("answer"),
  isCorrect: boolean("is_correct"),
  aiFeedback: text("ai_feedback"),
  marksAwarded: real("marks_awarded"),
}, (table) => [
  index("idx_responses_attempt_id").on(table.attemptId),
  index("idx_responses_question_id").on(table.questionId),
]);

export const aiProviders = pgTable("ai_providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  apiKeyEnv: text("api_key_env"),
  baseUrlEnv: text("base_url_env"),
  endpoint: text("endpoint"),
  model: text("model"),
  isActive: boolean("is_active").notNull().default(true),
  weight: integer("weight").notNull().default(1),
});

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  placeholders: jsonb("placeholders").$type<Record<string, string>>().default({}),
  createdBy: integer("created_by").references(() => admins.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const emailLogs = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => emailTemplates.id),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("pending"),
  sentAt: timestamp("sent_at"),
});

export const studentFeedback = pgTable("student_feedback", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull().references(() => exams.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => students.id),
  content: text("content").notNull(),
  rating: integer("rating"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => admins.id),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const aiMarkingJobs = pgTable("ai_marking_jobs", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull().references(() => exams.id),
  status: text("status").notNull().default("pending"),
  totalItems: integer("total_items").notNull().default(0),
  completedItems: integer("completed_items").notNull().default(0),
  prompt: text("prompt"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAdminSchema = createInsertSchema(admins).omit({ id: true, createdAt: true });
export const insertExamSchema = createInsertSchema(exams).omit({ id: true, createdAt: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true, createdAt: true });
export const insertExamStudentSchema = createInsertSchema(examStudents).omit({ id: true, createdAt: true });
export const insertQuestionSchema = createInsertSchema(questions).omit({ id: true });
export const insertQuestionOptionSchema = createInsertSchema(questionOptions).omit({ id: true });
export const insertSubquestionSchema = createInsertSchema(subquestions).omit({ id: true });
export const insertAttemptSchema = createInsertSchema(attempts).omit({ id: true, startedAt: true });
export const insertResponseSchema = createInsertSchema(responses).omit({ id: true });
export const insertAiProviderSchema = createInsertSchema(aiProviders).omit({ id: true });
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true, createdAt: true });
export const insertStudentFeedbackSchema = createInsertSchema(studentFeedback).omit({ id: true, createdAt: true });

export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Exam = typeof exams.$inferSelect;
export type InsertExam = z.infer<typeof insertExamSchema>;
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type ExamStudent = typeof examStudents.$inferSelect;
export type InsertExamStudent = z.infer<typeof insertExamStudentSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type InsertQuestionOption = z.infer<typeof insertQuestionOptionSchema>;
export type Subquestion = typeof subquestions.$inferSelect;
export type InsertSubquestion = z.infer<typeof insertSubquestionSchema>;
export type Attempt = typeof attempts.$inferSelect;
export type InsertAttempt = z.infer<typeof insertAttemptSchema>;
export type ExamResponse = typeof responses.$inferSelect;
export type InsertResponse = z.infer<typeof insertResponseSchema>;
export type AiProvider = typeof aiProviders.$inferSelect;
export type InsertAiProvider = z.infer<typeof insertAiProviderSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type StudentFeedbackType = typeof studentFeedback.$inferSelect;
export type InsertStudentFeedback = z.infer<typeof insertStudentFeedbackSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type AiMarkingJob = typeof aiMarkingJobs.$inferSelect;

export * from "./models/chat";

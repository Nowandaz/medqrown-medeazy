import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { markSAQResponses, markSingleResponse } from "./ai-orchestrator";
import { enqueueMarking } from "./marking-queue";
import { getExamStructure, invalidateExamCache } from "./exam-cache";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

function generatePassword(email: string): string {
  const prefix = email.split("@")[0].slice(0, 4).toLowerCase();
  const random = crypto.randomBytes(3).toString("hex");
  return `${prefix}${random}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "medqrown-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: isProduction ? "lax" : undefined,
      },
    })
  );

  if (process.env.REPL_ID) {
    registerObjectStorageRoutes(app);
  }

  // Admin Auth
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const admin = await storage.getAdminByEmail(email);
      if (!admin) return res.status(401).json({ message: "Invalid credentials" });
      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });
      (req.session as any).adminId = admin.id;
      res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/admin/me", async (req, res) => {
    const adminId = (req.session as any)?.adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const admin = await storage.getAdmin(adminId);
    if (!admin) return res.status(401).json({ message: "Not authenticated" });
    res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
  });

  app.post("/api/admin/change-password", async (req, res) => {
    const adminId = (req.session as any)?.adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const { currentPassword, newPassword } = req.body;
    const admin = await storage.getAdmin(adminId);
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) return res.status(400).json({ message: "Current password is incorrect" });
    const hash = await bcrypt.hash(newPassword, 10);
    await storage.updateAdminPassword(adminId, hash);
    res.json({ ok: true });
  });

  // Admin middleware
  const requireAdmin = async (req: any, res: any, next: any) => {
    const adminId = req.session?.adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const admin = await storage.getAdmin(adminId);
    if (!admin) return res.status(401).json({ message: "Not authenticated" });
    req.admin = admin;
    next();
  };

  // Exams
  app.get("/api/exams", requireAdmin, async (req, res) => {
    const exams = await storage.getAllExams();
    res.json(exams);
  });

  app.get("/api/exams/:id", requireAdmin, async (req, res) => {
    const exam = await storage.getExam(parseInt(req.params.id));
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    const stats = await storage.getExamStats(exam.id);
    res.json({ ...exam, stats });
  });

  app.post("/api/exams", requireAdmin, async (req, res) => {
    const exam = await storage.createExam({ ...req.body, createdBy: (req as any).admin.id });
    await storage.createAuditLog({ adminId: (req as any).admin.id, action: "create_exam", details: exam.title });
    res.json(exam);
  });

  app.patch("/api/exams/:id", requireAdmin, async (req, res) => {
    const exam = await storage.updateExam(parseInt(req.params.id), req.body);
    res.json(exam);
  });

  app.delete("/api/exams/:id", requireAdmin, async (req, res) => {
    await storage.deleteExam(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Exam Students
  app.get("/api/exams/:examId/students", requireAdmin, async (req, res) => {
    const students = await storage.getStudentsByExam(parseInt(req.params.examId));
    const studentsWithAttempts = await Promise.all(students.map(async (es) => {
      const attempt = await storage.getAttemptByExamStudent(es.id);
      return { ...es, attempt };
    }));
    res.json(studentsWithAttempts);
  });

  app.post("/api/exams/:examId/students", requireAdmin, async (req, res) => {
    const examId = parseInt(req.params.examId);
    const { name, email } = req.body;
    let student = await storage.getStudentByEmail(email);
    if (!student) {
      student = await storage.createStudent({ name, email });
    }
    const existing = await storage.getExamStudentByExamAndStudent(examId, student.id);
    if (existing) return res.status(400).json({ message: "Student already added to this exam" });
    const password = generatePassword(email);
    const examStudent = await storage.createExamStudent({
      examId,
      studentId: student.id,
      password,
      attemptStatus: "not_started",
      resetCount: 0,
      emailSent: false,
    });
    res.json({ ...examStudent, student });
  });

  app.delete("/api/exams/:examId/students/:esId", requireAdmin, async (req, res) => {
    await storage.deleteExamStudent(parseInt(req.params.esId));
    res.json({ ok: true });
  });

  app.post("/api/exams/:examId/students/:esId/reset", requireAdmin, async (req, res) => {
    await storage.resetAttempt(parseInt(req.params.esId));
    await storage.createAuditLog({ adminId: (req as any).admin.id, action: "reset_attempt", details: `ExamStudent ${req.params.esId}` });
    res.json({ ok: true });
  });

  // Questions
  app.get("/api/exams/:examId/questions", requireAdmin, async (req, res) => {
    const qs = await storage.getQuestionsByExam(parseInt(req.params.examId));
    const withDetails = await Promise.all(qs.map(async (q) => {
      const options = q.type === "mcq" ? await storage.getQuestionOptions(q.id) : [];
      const subs = q.hasSubquestions ? await storage.getSubquestions(q.id) : [];
      return { ...q, options, subquestions: subs };
    }));
    res.json(withDetails);
  });

  app.post("/api/exams/:examId/questions", requireAdmin, async (req, res) => {
    const examId = parseInt(req.params.examId);
    const { type, content, marks, expectedAnswer, imageUrl, imageCaption, hasSubquestions, options, subquestions: subs } = req.body;
    const existingQs = await storage.getQuestionsByExam(examId);
    const orderIndex = existingQs.length;
    const question = await storage.createQuestion({
      examId, type, content, orderIndex, marks: marks || 1,
      expectedAnswer, imageUrl, imageCaption, hasSubquestions: hasSubquestions || false,
    });

    if (type === "mcq" && options) {
      for (let i = 0; i < options.length; i++) {
        await storage.createQuestionOption({
          questionId: question.id, content: options[i].content,
          isCorrect: options[i].isCorrect || false, orderIndex: i,
        });
      }
    }

    if (hasSubquestions && subs) {
      for (let i = 0; i < subs.length; i++) {
        await storage.createSubquestion({
          questionId: question.id, content: subs[i].content,
          marks: subs[i].marks || 1, expectedAnswer: subs[i].expectedAnswer, orderIndex: i,
        });
      }
    }

    invalidateExamCache(examId);
    const created = {
      ...question,
      options: type === "mcq" ? await storage.getQuestionOptions(question.id) : [],
      subquestions: hasSubquestions ? await storage.getSubquestions(question.id) : [],
    };
    res.json(created);
  });

  app.delete("/api/exams/:examId/questions/:qId", requireAdmin, async (req, res) => {
    invalidateExamCache(parseInt(req.params.examId));
    await storage.deleteQuestion(parseInt(req.params.qId));
    res.json({ ok: true });
  });

  // Rankings
  app.get("/api/exams/:examId/rankings", requireAdmin, async (req, res) => {
    const rankings = await storage.getExamRankings(parseInt(req.params.examId));
    res.json(rankings);
  });

  // Analytics
  app.get("/api/exams/:examId/analytics", requireAdmin, async (req, res) => {
    const analytics = await storage.getQuestionAnalytics(parseInt(req.params.examId));
    res.json(analytics);
  });

  // Feedback
  app.get("/api/exams/:examId/feedback", requireAdmin, async (req, res) => {
    const feedback = await storage.getStudentFeedback(parseInt(req.params.examId));
    res.json(feedback);
  });

  // AI Marking
  app.post("/api/exams/:examId/mark", requireAdmin, async (req, res) => {
    const examId = parseInt(req.params.examId);
    const { prompt } = req.body;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    try {
      const { jobId, results } = await markSAQResponses(examId, prompt, (completed, total) => {
        res.write(`data: ${JSON.stringify({ type: "progress", completed, total })}\n\n`);
      });
      res.write(`data: ${JSON.stringify({ type: "complete", jobId, totalMarked: results.length })}\n\n`);
      res.end();
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
      res.end();
    }
  });

  app.get("/api/exams/:examId/marking-jobs", requireAdmin, async (req, res) => {
    const jobs = await storage.getAiMarkingJobsByExam(parseInt(req.params.examId));
    res.json(jobs);
  });

  // AI Providers
  app.get("/api/ai-providers", requireAdmin, async (req, res) => {
    const providers = await storage.getAiProviders();
    res.json(providers);
  });

  app.post("/api/ai-providers", requireAdmin, async (req, res) => {
    const { apiKeyValue, ...providerData } = req.body;
    const BLOCKED_KEYS = ["SESSION_SECRET", "DATABASE_URL", "SMTP_PASS", "SMTP_USER", "SMTP_HOST", "SMTP_PORT", "SMTP_FROM_NAME", "PRIVATE_OBJECT_DIR", "PUBLIC_OBJECT_SEARCH_PATHS", "DEFAULT_OBJECT_STORAGE_BUCKET_ID", "NODE_ENV", "PORT", "REPL_ID"];
    if (apiKeyValue && providerData.apiKeyEnv && !BLOCKED_KEYS.includes(providerData.apiKeyEnv)) {
      process.env[providerData.apiKeyEnv] = apiKeyValue;
    }
    const provider = await storage.createAiProvider(providerData);
    res.json(provider);
  });

  app.post("/api/ai-providers/set-key", requireAdmin, async (req, res) => {
    const { envVarName, apiKeyValue } = req.body;
    if (!envVarName || !apiKeyValue) return res.status(400).json({ message: "Missing envVarName or apiKeyValue" });
    const BLOCKED_KEYS = ["SESSION_SECRET", "DATABASE_URL", "SMTP_PASS", "SMTP_USER", "SMTP_HOST", "SMTP_PORT", "SMTP_FROM_NAME", "PRIVATE_OBJECT_DIR", "PUBLIC_OBJECT_SEARCH_PATHS", "DEFAULT_OBJECT_STORAGE_BUCKET_ID", "NODE_ENV", "PORT", "REPL_ID"];
    if (BLOCKED_KEYS.includes(envVarName)) return res.status(400).json({ message: "Cannot override protected environment variable" });
    process.env[envVarName] = apiKeyValue;
    res.json({ ok: true });
  });

  app.patch("/api/ai-providers/:id", requireAdmin, async (req, res) => {
    await storage.updateAiProvider(parseInt(req.params.id), req.body);
    res.json({ ok: true });
  });

  app.delete("/api/ai-providers/:id", requireAdmin, async (req, res) => {
    await storage.deleteAiProvider(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Email Templates
  app.get("/api/email-templates", requireAdmin, async (req, res) => {
    const templates = await storage.getEmailTemplates();
    res.json(templates);
  });

  app.post("/api/email-templates", requireAdmin, async (req, res) => {
    const template = await storage.createEmailTemplate({ ...req.body, createdBy: (req as any).admin.id });
    res.json(template);
  });

  app.patch("/api/email-templates/:id", requireAdmin, async (req, res) => {
    await storage.updateEmailTemplate(parseInt(req.params.id), req.body);
    res.json({ ok: true });
  });

  // Send email (mass or single) via Gmail SMTP
  app.post("/api/exams/:examId/send-emails", requireAdmin, async (req, res) => {
    const examId = parseInt(req.params.examId);
    const { templateId, studentIds, customSubject, customBody } = req.body;
    const exam = await storage.getExam(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const template = templateId ? await storage.getEmailTemplate(templateId) : null;
    const allStudents = await storage.getStudentsByExam(examId);
    const targets = studentIds
      ? allStudents.filter((s: any) => studentIds.includes(s.id))
      : allStudents;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const subjectTemplate = customSubject || template?.subject || "MedQrown MedEazy {exam_name} - Your Access Credentials";
    const bodyTemplate = customBody || template?.body || getDefaultEmailBody();
    const customPlaceholders: Record<string, string> = (template as any)?.placeholders || {};

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const es of targets) {
      let subject = subjectTemplate
        .replace(/{exam_name}/g, customPlaceholders.exam_name || exam.title)
        .replace(/{student_name}/g, customPlaceholders.student_name || es.student.name);

      let body = bodyTemplate
        .replace(/{student_name}/g, customPlaceholders.student_name || es.student.name)
        .replace(/{exam_name}/g, customPlaceholders.exam_name || exam.title)
        .replace(/{email}/g, customPlaceholders.email || es.student.email)
        .replace(/{password}/g, customPlaceholders.password || es.password)
        .replace(/{portal_link}/g, customPlaceholders.portal_link || req.headers.origin || "");

      for (const [key, val] of Object.entries(customPlaceholders)) {
        if (!["student_name", "exam_name", "email", "password", "portal_link"].includes(key)) {
          subject = subject.replace(new RegExp(`{${key}}`, "g"), val);
          body = body.replace(new RegExp(`{${key}}`, "g"), val);
        }
      }

      let status = "failed";
      try {
        await transporter.sendMail({
          from: `"${process.env.SMTP_FROM_NAME || "MedQrown MedEazy"}" <${process.env.SMTP_USER}>`,
          to: es.student.email,
          subject,
          text: body,
        });
        status = "sent";
        successCount++;
        await storage.updateExamStudent(es.id, { emailSent: true });
      } catch (err: any) {
        console.error(`Email to ${es.student.email} failed:`, err.message);
        status = "failed";
        failCount++;
      }

      await storage.createEmailLog({
        templateId: template?.id,
        recipientEmail: es.student.email,
        subject,
        status,
      });

      results.push({
        studentName: es.student.name,
        email: es.student.email,
        status,
      });
    }

    res.json({ total: results.length, sent: successCount, failed: failCount, emails: results });
  });

  // Get exam responses for marking view
  app.get("/api/exams/:examId/responses", requireAdmin, async (req, res) => {
    const examId = parseInt(req.params.examId);
    const examStudentsList = await storage.getStudentsByExam(examId);
    const allResponses: any[] = [];

    for (const es of examStudentsList) {
      if (es.attemptStatus !== "submitted") continue;
      const attempt = await storage.getAttemptByExamStudent(es.id);
      if (!attempt) continue;
      const responses = await storage.getResponsesByAttempt(attempt.id);
      for (const r of responses) {
        const question = await storage.getQuestion(r.questionId);
        let subqContent = null;
        if (r.subquestionId) {
          const { db } = await import("./db");
          const { subquestions: sqTable } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          const [sq] = await db.select().from(sqTable).where(eq(sqTable.id, r.subquestionId));
          subqContent = sq?.content;
        }
        allResponses.push({
          ...r,
          studentName: es.student.name,
          studentEmail: es.student.email,
          questionContent: question?.content,
          questionType: question?.type,
          subquestionContent: subqContent,
        });
      }
    }

    res.json(allResponses);
  });

  // Mark individual response
  app.post("/api/responses/:responseId/mark", requireAdmin, async (req, res) => {
    try {
      const result = await markSingleResponse(parseInt(req.params.responseId), req.body.prompt);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Student Portal APIs
  app.get("/api/student/active-exams", async (req, res) => {
    const { db } = await import("./db");
    const { exams: examsTable } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const activeExams = await db.select({ id: examsTable.id, title: examsTable.title })
      .from(examsTable).where(eq(examsTable.status, "active"));
    res.json(activeExams);
  });

  app.post("/api/student/login", async (req, res) => {
    const { examId, email, password } = req.body;
    const es = await storage.getExamStudentByCredentials(parseInt(examId), email, password);
    if (!es) return res.status(401).json({ message: "Invalid credentials" });
    (req.session as any).examStudentId = es.id;
    (req.session as any).studentExamId = parseInt(examId);
    res.json({
      examStudentId: es.id,
      studentName: es.student.name,
      attemptStatus: es.attemptStatus,
    });
  });

  app.get("/api/student/session", async (req, res) => {
    const esId = (req.session as any)?.examStudentId;
    if (!esId) return res.status(401).json({ message: "Not authenticated" });
    const es = await storage.getExamStudent(esId);
    if (!es) return res.status(401).json({ message: "Not authenticated" });
    const student = await storage.getStudent(es.studentId);
    res.json({
      examStudentId: es.id,
      examId: es.examId,
      studentName: student?.name,
      attemptStatus: es.attemptStatus,
    });
  });

  app.post("/api/student/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/student/exam-info", async (req, res) => {
    const esId = (req.session as any)?.examStudentId;
    if (!esId) return res.status(401).json({ message: "Not authenticated" });
    const es = await storage.getExamStudent(esId);
    if (!es) return res.status(401).json({ message: "Not authenticated" });
    const exam = await storage.getExam(es.examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    const qs = await storage.getQuestionsByExam(exam.id);
    const mcqCount = qs.filter(q => q.type === "mcq").length;
    const saqCount = qs.filter(q => q.type === "saq").length;
    res.json({
      examId: exam.id,
      title: exam.title,
      timerMode: exam.timerMode,
      perQuestionSeconds: exam.perQuestionSeconds,
      fullExamSeconds: exam.fullExamSeconds,
      totalQuestions: qs.length,
      mcqCount,
      saqCount,
      attemptStatus: es.attemptStatus,
    });
  });

  app.post("/api/student/start-exam", async (req, res) => {
    const esId = (req.session as any)?.examStudentId;
    if (!esId) return res.status(401).json({ message: "Not authenticated" });
    const es = await storage.getExamStudent(esId);
    if (!es) return res.status(401).json({ message: "Session expired" });

    if (es.attemptStatus === "submitted") {
      return res.status(400).json({ message: "Exam already submitted" });
    }

    let attempt = await storage.getAttemptByExamStudent(esId);
    if (!attempt) {
      const exam = await storage.getExam(es.examId);
      const remainingTime = exam?.timerMode === "full_exam" ? exam.fullExamSeconds
        : exam?.timerMode === "per_question" ? exam.perQuestionSeconds
        : null;

      attempt = await storage.createAttempt({
        examStudentId: esId,
        status: "in_progress",
        currentQuestionIndex: 0,
        remainingTime,
      });
      await storage.updateExamStudent(esId, { attemptStatus: "in_progress" });
    }

    const exam = await storage.getExam(es.examId);
    const qs = await storage.getQuestionsByExam(es.examId);
    const currentQ = qs[attempt.currentQuestionIndex];
    let questionData: any = null;
    if (currentQ) {
      const options = currentQ.type === "mcq" ? await storage.getQuestionOptions(currentQ.id) : [];
      const subs = currentQ.hasSubquestions ? await storage.getSubquestions(currentQ.id) : [];
      const existingResponse = await storage.getResponse(attempt.id, currentQ.id);
      questionData = {
        ...currentQ,
        expectedAnswer: undefined,
        options: options.map(o => ({ id: o.id, content: o.content, orderIndex: o.orderIndex })),
        subquestions: subs.map(s => ({ id: s.id, content: s.content, marks: s.marks, orderIndex: s.orderIndex })),
        savedAnswer: existingResponse?.answer || null,
      };

      if (currentQ.hasSubquestions) {
        const subResponses: Record<number, string> = {};
        for (const s of subs) {
          const sr = await storage.getResponse(attempt.id, currentQ.id, s.id);
          if (sr?.answer) subResponses[s.id] = sr.answer;
        }
        questionData.savedSubAnswers = subResponses;
      }
    }

    res.json({
      attemptId: attempt.id,
      currentQuestionIndex: attempt.currentQuestionIndex,
      totalQuestions: qs.length,
      remainingTime: attempt.remainingTime,
      timerMode: exam?.timerMode,
      perQuestionSeconds: exam?.perQuestionSeconds,
      question: questionData,
    });
  });

  app.post("/api/student/save-answer", async (req, res) => {
    const esId = (req.session as any)?.examStudentId;
    if (!esId) return res.status(401).json({ message: "Not authenticated" });
    const { attemptId, questionId, subquestionId, answer } = req.body;

    const attempt = await storage.getAttempt(attemptId);
    if (!attempt || attempt.status === "submitted") {
      return res.status(400).json({ message: "Invalid attempt" });
    }
    if (attempt.examStudentId !== esId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const question = await storage.getQuestion(questionId);
    if (!question) return res.status(404).json({ message: "Question not found" });

    if (question.type === "mcq" && !subquestionId) {
      const options = await storage.getQuestionOptions(questionId);
      const selectedOption = options.find(o => o.id === parseInt(answer));
      const isCorrect = selectedOption?.isCorrect || false;
      await storage.upsertResponse({
        attemptId, questionId, subquestionId: null,
        answer, isCorrect, marksAwarded: isCorrect ? question.marks : 0,
        aiFeedback: null,
      });
    } else {
      await storage.upsertResponse({
        attemptId, questionId, subquestionId: subquestionId || null,
        answer, isCorrect: null, marksAwarded: null, aiFeedback: null,
      });
    }

    res.json({ ok: true });
  });

  app.post("/api/student/next-question", async (req, res) => {
    const esId = (req.session as any)?.examStudentId;
    if (!esId) return res.status(401).json({ message: "Not authenticated" });
    const { attemptId } = req.body;
    const attempt = await storage.getAttempt(attemptId);
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    if (attempt.examStudentId !== esId) return res.status(403).json({ message: "Forbidden" });
    const es = await storage.getExamStudent(attempt.examStudentId);
    if (!es) return res.status(404).json({ message: "Exam student not found" });
    const exam = await storage.getExam(es.examId);
    const qs = await storage.getQuestionsByExam(es.examId);
    const nextIndex = attempt.currentQuestionIndex + 1;

    if (nextIndex >= qs.length) {
      return res.status(400).json({ message: "No more questions", isLastQuestion: true });
    }

    const remainingTime = exam?.timerMode === "per_question" ? exam.perQuestionSeconds : attempt.remainingTime;
    await storage.updateAttempt(attemptId, { currentQuestionIndex: nextIndex, remainingTime });

    const nextQ = qs[nextIndex];
    const options = nextQ.type === "mcq" ? await storage.getQuestionOptions(nextQ.id) : [];
    const subs = nextQ.hasSubquestions ? await storage.getSubquestions(nextQ.id) : [];
    const existingResponse = await storage.getResponse(attemptId, nextQ.id);

    const questionData: any = {
      ...nextQ,
      expectedAnswer: undefined,
      options: options.map(o => ({ id: o.id, content: o.content, orderIndex: o.orderIndex })),
      subquestions: subs.map(s => ({ id: s.id, content: s.content, marks: s.marks, orderIndex: s.orderIndex })),
      savedAnswer: existingResponse?.answer || null,
    };

    if (nextQ.hasSubquestions) {
      const subResponses: Record<number, string> = {};
      for (const s of subs) {
        const sr = await storage.getResponse(attemptId, nextQ.id, s.id);
        if (sr?.answer) subResponses[s.id] = sr.answer;
      }
      questionData.savedSubAnswers = subResponses;
    }

    res.json({
      currentQuestionIndex: nextIndex,
      totalQuestions: qs.length,
      remainingTime,
      question: questionData,
    });
  });

  app.post("/api/student/update-timer", async (req, res) => {
    const esId = (req.session as any)?.examStudentId;
    if (!esId) return res.status(401).json({ message: "Not authenticated" });
    const { attemptId, remainingTime } = req.body;
    const attempt = await storage.getAttempt(attemptId);
    if (!attempt || attempt.examStudentId !== esId) return res.status(403).json({ message: "Forbidden" });
    await storage.updateAttempt(attemptId, { remainingTime });
    res.json({ ok: true });
  });

  app.post("/api/student/submit-exam", async (req, res) => {
    const esId = (req.session as any)?.examStudentId;
    if (!esId) return res.status(401).json({ message: "Not authenticated" });
    const { attemptId } = req.body;
    const attempt = await storage.getAttempt(attemptId);
    if (!attempt || attempt.examStudentId !== esId) return res.status(403).json({ message: "Forbidden" });
    await storage.updateAttempt(attemptId, { status: "submitted", submittedAt: new Date() });
    await storage.updateExamStudent(esId, { attemptStatus: "submitted" });
    res.json({ ok: true });

    const es = await storage.getExamStudent(esId);
    if (es) {
      const exam = await storage.getExam(es.examId);
      if (exam?.autoMarkEnabled) {
        try {
          const providers = (await storage.getAiProviders()).filter(p => p.isActive);
          if (providers.length > 0) {
            console.log(`[Auto-Mark] Queuing auto-marking for exam ${es.examId} after student submission`);
            enqueueMarking(es.examId).catch(err =>
              console.error(`[Auto-Mark] Error:`, err.message)
            );
          }
        } catch (err: any) {
          console.error(`[Auto-Mark] Error checking providers:`, err.message);
        }
      }
    }
  });

  app.get("/api/student/results", async (req, res) => {
    const esId = (req.session as any)?.examStudentId;
    if (!esId) return res.status(401).json({ message: "Not authenticated" });
    const es = await storage.getExamStudent(esId);
    if (!es) return res.status(404).json({ message: "Not found" });
    const exam = await storage.getExam(es.examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const attempt = await storage.getAttemptByExamStudent(esId);
    if (!attempt) return res.status(404).json({ message: "No attempt found" });

    const resps = await storage.getResponsesByAttempt(attempt.id);
    const examStructure = await getExamStructure(es.examId);
    const { questions: qs, optionsByQuestion, subsByQuestion, maxScore } = examStructure;

    const hasSAQ = qs.some(q => q.type === "saq");
    const saqResponses = resps.filter(r => {
      const q = qs.find(q => q.id === r.questionId);
      return q?.type === "saq";
    });
    const unmarkedSAQ = saqResponses.filter(r => r.isCorrect === null);
    const markingInProgress = hasSAQ && unmarkedSAQ.length > 0;

    if (markingInProgress && attempt.status === "submitted") {
      return res.json({
        released: false,
        markingInProgress: true,
        totalSAQ: saqResponses.length,
        markedSAQ: saqResponses.length - unmarkedSAQ.length,
        message: "AI is marking your answers. Please wait..."
      });
    }

    if (!exam.resultsReleased) {
      return res.json({ released: false, markingInProgress: false, message: "Results have not been released yet." });
    }

    const totalScore = resps.reduce((sum, r) => sum + (r.marksAwarded || 0), 0);

    const questionResults = qs.map((q) => {
      const options = optionsByQuestion.get(q.id) || [];
      const subs = subsByQuestion.get(q.id) || [];
      const qResps = resps.filter(r => r.questionId === q.id);
      return {
        ...q,
        options,
        subquestions: subs,
        responses: qResps,
      };
    });

    res.json({
      released: true,
      markingInProgress: false,
      examTitle: exam.title,
      totalScore,
      maxScore,
      percentage: maxScore > 0 ? (totalScore / maxScore) * 100 : 0,
      questions: questionResults,
    });
  });

  app.post("/api/student/feedback", async (req, res) => {
    const esId = (req.session as any)?.examStudentId;
    if (!esId) return res.status(401).json({ message: "Not authenticated" });
    const es = await storage.getExamStudent(esId);
    if (!es) return res.status(404).json({ message: "Not found" });
    const { content, rating } = req.body;
    const student = await storage.getStudent(es.studentId);
    const fb = await storage.createStudentFeedback({
      examId: es.examId,
      studentId: es.studentId,
      content,
      rating,
    });
    res.json(fb);
  });

  // Admin management
  app.get("/api/admins", requireAdmin, async (req, res) => {
    const allAdmins = await storage.getAllAdmins();
    res.json(allAdmins.map(a => ({ id: a.id, email: a.email, name: a.name, role: a.role, isActive: a.isActive })));
  });

  app.post("/api/admins", requireAdmin, async (req, res) => {
    if ((req as any).admin.role !== "super_admin") {
      return res.status(403).json({ message: "Only super admins can create admins" });
    }
    const { email, name, role, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const admin = await storage.createAdmin({ email, name, role, passwordHash: hash, isActive: true });
    res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
  });

  return httpServer;
}

function getDefaultEmailBody(): string {
  return `MedQrown MedEazy {exam_name} - Your Access Credentials and Instructions

Dear {student_name},

This is a reminder for your MedQrown MedEazy {exam_name} examination access.

Your Login Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email: {email}
Password: {password}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Portal Access Link:
{portal_link}

Important Instructions:
- Click the link above to access the portal
- Log in with your credentials
- Your answers are auto-saved
- You can only submit once
- Keep your credentials secure and private

If you have any questions, please contact your exam administrator.

Best regards,
MedQrown MedEazy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated message. Please do not reply.`;
}

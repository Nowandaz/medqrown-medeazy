import bcrypt from "bcryptjs";
import { storage } from "./storage";

export async function seed() {
  const existing = await storage.getAdminByEmail("norysndachule@gmail.com");
  if (existing) return;

  const hash = await bcrypt.hash("admin123", 10);
  await storage.createAdmin({
    email: "norysndachule@gmail.com",
    passwordHash: hash,
    name: "Norys Ndachule",
    role: "super_admin",
    isActive: true,
  });

  await storage.createAiProvider({
    name: "OpenAI (Replit)",
    type: "openai",
    apiKeyEnv: "AI_INTEGRATIONS_OPENAI_API_KEY",
    baseUrlEnv: "AI_INTEGRATIONS_OPENAI_BASE_URL",
    isActive: true,
    weight: 2,
  });

  await storage.createAiProvider({
    name: "Gemini (Replit)",
    type: "gemini",
    apiKeyEnv: "AI_INTEGRATIONS_GEMINI_API_KEY",
    baseUrlEnv: "AI_INTEGRATIONS_GEMINI_BASE_URL",
    isActive: true,
    weight: 1,
  });

  await storage.createAiProvider({
    name: "Anthropic (Replit)",
    type: "anthropic",
    apiKeyEnv: "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
    baseUrlEnv: "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
    isActive: true,
    weight: 1,
  });

  await storage.createEmailTemplate({
    name: "Default Credentials Email",
    subject: "MedQrown MedEazy {exam_name} - Your Access Credentials and Instructions",
    body: `Dear {student_name},

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
Norys Ndachule
MedQrown MedEazy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated message. Please do not reply.`,
    createdBy: 1,
  });

  console.log("Seed data created successfully");
}

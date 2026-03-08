import "dotenv/config";
import { execSync } from "child_process";
import * as readline from "readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));

async function setup() {
  console.log("\n========================================");
  console.log("  MedQrown MedEazy - Setup Wizard");
  console.log("========================================\n");

  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL is not set.\n");
    console.log("To get it from Supabase:");
    console.log("  1. Go to supabase.com and create a project");
    console.log("  2. Go to Settings > Database");
    console.log("  3. Copy the 'Connection string (URI)' under 'Connection string'\n");
    const dbUrl = await ask("Paste your DATABASE_URL here: ");
    if (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://")) {
      console.log("Invalid DATABASE_URL. It should start with postgresql:// or postgres://");
      process.exit(1);
    }
    process.env.DATABASE_URL = dbUrl;
    appendEnv("DATABASE_URL", dbUrl);
    console.log("Saved to .env file.\n");
  } else {
    console.log("DATABASE_URL is already set.\n");
  }

  if (!process.env.SESSION_SECRET) {
    const secret = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    process.env.SESSION_SECRET = secret;
    appendEnv("SESSION_SECRET", secret);
    console.log("Generated SESSION_SECRET and saved to .env file.\n");
  }

  console.log("Pushing database schema...");
  try {
    execSync("npx drizzle-kit push", { stdio: "inherit", env: process.env });
    console.log("Database schema created successfully.\n");
  } catch {
    console.log("Failed to push schema. Check your DATABASE_URL.\n");
    process.exit(1);
  }

  console.log("Seeding admin user and default data...");
  try {
    const { seed } = await import("./server/seed");
    await seed();
    console.log("Admin user created: norysndachule@gmail.com / admin123\n");
  } catch (err: any) {
    console.log("Seed note:", err.message, "\n");
  }

  console.log("----------------------------------------");
  console.log("  Optional: Email Configuration (Gmail)");
  console.log("----------------------------------------\n");

  if (!process.env.SMTP_PASS) {
    const configEmail = await ask("Do you want to set up Gmail SMTP now? (y/n): ");
    if (configEmail.toLowerCase() === "y") {
      console.log("\nTo get a Gmail App Password:");
      console.log("  1. Go to myaccount.google.com > Security");
      console.log("  2. Enable 2-Step Verification");
      console.log("  3. Search for 'App passwords'");
      console.log("  4. Create one for 'Mail'\n");
      const smtpPass = await ask("Paste your Gmail App Password (16 chars, no spaces): ");
      appendEnv("SMTP_HOST", "smtp.gmail.com");
      appendEnv("SMTP_PORT", "587");
      appendEnv("SMTP_USER", "medqrownmedicalsolutions24@gmail.com");
      appendEnv("SMTP_PASS", smtpPass.replace(/\s/g, ""));
      appendEnv("SMTP_FROM_NAME", "MedQrown MedEazy");
      console.log("SMTP configuration saved to .env file.\n");
    }
  } else {
    console.log("SMTP is already configured.\n");
  }

  console.log("----------------------------------------");
  console.log("  Optional: AI Provider Configuration");
  console.log("----------------------------------------\n");

  if (!process.env.OPENROUTER_API_KEY) {
    const configAI = await ask("Do you want to set up an AI provider for SAQ marking? (y/n): ");
    if (configAI.toLowerCase() === "y") {
      console.log("\nRecommended: OpenRouter (supports many models, cheap)");
      console.log("  1. Go to openrouter.ai and create an account");
      console.log("  2. Go to Keys and create an API key\n");
      const apiKey = await ask("Paste your OpenRouter API key: ");
      appendEnv("OPENROUTER_API_KEY", apiKey.trim());
      console.log("API key saved. You can configure the AI provider in the admin panel.\n");
    }
  } else {
    console.log("AI provider key already configured.\n");
  }

  console.log("========================================");
  console.log("  Setup Complete!");
  console.log("========================================\n");
  console.log("Start the app with:  npm run dev\n");
  console.log("Then open the app in your browser and log in:");
  console.log("  Admin: norysndachule@gmail.com / admin123\n");
  console.log("Note: If you need to upload question images,");
  console.log("you can use any file hosting service (Supabase Storage,");
  console.log("Cloudflare R2, etc.) and paste the URLs when creating questions.\n");

  rl.close();
  process.exit(0);
}

function appendEnv(key: string, value: string) {
  const fs = require("fs");
  const line = `${key}=${value}\n`;
  fs.appendFileSync(".env", line);
}

setup().catch(err => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});

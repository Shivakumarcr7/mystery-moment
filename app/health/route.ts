import { NextResponse } from "next/server";
import { DEFAULT_GROQ_MODEL } from "@/lib/mysteryEngine";

export async function GET() {
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
  return NextResponse.json({
    status: "online",
    provider: hasGroqKey ? "Groq" : "Simulated (set GROQ_API_KEY for live Groq)",
    model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
    agent: "murder-mystery-detective",
  });
}

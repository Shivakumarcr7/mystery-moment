import { NextResponse } from "next/server";
import { resolveGroqModel } from "@/lib/mysteryEngine";

export async function GET() {
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY?.trim());
  const hasMorseKey = Boolean(process.env.MORSE_API_KEY?.trim());
  return NextResponse.json({
    status: "online",
    provider: hasGroqKey ? "Groq" : "Simulated (set GROQ_API_KEY for live Groq)",
    model: resolveGroqModel(process.env.GROQ_MODEL),
    morseTelemetry: hasMorseKey ? "enabled" : "disabled",
    agent: "murder-mystery-detective",
  });
}

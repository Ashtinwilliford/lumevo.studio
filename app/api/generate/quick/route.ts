import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, contentType } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

  const rows = await query("SELECT * FROM brand_profiles WHERE user_id = $1", [session.id]);
  const brand = rows.rows[0];

  const brandContext = brand
    ? `Brand voice: ${brand.voice_style || "conversational"}\nTone: ${brand.tone_keywords?.join(", ") || "authentic, engaging"}\nNiche: ${brand.niche || "lifestyle content"}\nAudience: ${brand.target_audience || "general audience"}`
    : "Create content that is authentic, engaging, and relatable.";

  const typeInstructions: Record<string, string> = {
    caption:
      "Write a short, punchy social media caption (2-4 sentences max). Use hooks, be conversational, and end with a subtle CTA or question. No hashtags unless specifically requested.",
    script:
      "Write a voiceover script formatted for short-form video (TikTok/Reels style). Include natural pauses with '...' Include an opening hook (first 3 seconds), the main story/value, and a closing CTA. Keep it under 60 seconds spoken at a natural pace. Format as a clean script with stage directions in brackets if needed.",
    text:
      "Write the requested content in a natural, conversational tone that sounds human and authentic. Match the energy to the request.",
  };

  const systemPrompt = `You are a content creation AI for Lumevo Studio. You write content that sounds like the creator, not like a bot.

${brandContext}

Rules:
- Write in first person as the creator
- Sound human, not corporate
- Match the energy and platform context of the request
- ${typeInstructions[contentType] || typeInstructions.text}
- Never use em-dashes (—), replace with commas or periods
- Never say "I cannot" — always write the content`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    max_tokens: 600,
    temperature: 0.85,
  });

  const generated = completion.choices[0]?.message?.content?.trim() || "";
  return NextResponse.json({ generated });
}

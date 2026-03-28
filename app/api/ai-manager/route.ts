import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

const OPENAI_BASE = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { message, history } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const brandResult = await query(`SELECT * FROM brand_profiles WHERE user_id = $1`, [session.id]);
  const brand = brandResult.rows[0] || {};

  const brandContext = brand.tone_summary
    ? `User's brand profile: Tone: ${brand.tone_summary}. Personality: ${brand.personality_summary || "authentic"}. Audience: ${brand.audience_summary || "general"}.`
    : "User is still building their brand profile.";

  const systemPrompt = `You are the Lumevo AI Manager — a premium creative director and content strategist embedded inside Lumevo Studio. You are not a generic chatbot. You are a high-level creative partner who thinks, plans, and directs like an experienced creative director with deep expertise in social media, brand building, and content creation.

${brandContext}

Your job:
- Understand what the creator wants and give them clear, specific, actionable creative direction
- Think in terms of storytelling, pacing, hooks, aesthetics, and brand consistency
- Give direction with confidence — you are the expert
- Be concise but insightful. Premium, not fluffy
- When asked to create content, generate it directly
- When asked for strategy, give real recommendations — not generic advice
- Speak like a creative director, not a customer service bot

You can help with:
- Video creative direction and editing decisions
- Writing scripts, hooks, captions, and voiceovers
- Developing content strategies and posting calendars
- Brand voice and visual identity decisions
- Analyzing what's working and why
- Creating multiple versions of content for testing`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...(history || []).slice(-8).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature: 0.8, max_tokens: 1500 }),
    });

    if (!res.ok) return NextResponse.json({ error: "AI unavailable" }, { status: 500 });

    const data = await res.json();
    const reply = data.choices[0].message.content;

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

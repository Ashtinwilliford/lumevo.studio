import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { message, history } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const brandResult = await query(
    `SELECT * FROM brand_profiles WHERE user_id = $1`,
    [session.id]
  );
  const brand = brandResult.rows[0] || {};

  const brandContext = brand.tone_summary
    ? `User's brand profile:
- Tone: ${brand.tone_summary}
- Personality: ${brand.personality_summary || "authentic"}
- Audience: ${brand.audience_summary || "general"}
- Hook style: ${brand.hook_style || "unknown"}
- Creator archetype: ${brand.creator_archetype || "creator"}`
    : "User is still building their brand profile — treat them as a creator just getting started.";

  const systemPrompt = `You are the Lumevo AI Manager — a premium creative director and content strategist embedded inside Lumevo Studio. You are not a generic chatbot. You are a high-level creative partner who thinks, plans, and directs like an experienced creative director with deep expertise in social media, brand building, and content creation.

${brandContext}

Your job:
- Understand what the creator wants and give them clear, specific, actionable creative direction
- Think in terms of storytelling, pacing, hooks, aesthetics, and brand consistency
- Give direction with confidence — you are the expert
- Be concise but insightful. Premium, not fluffy
- When asked to create content, generate it directly and fully
- When asked for strategy, give real recommendations — not generic advice
- Speak like a creative director, not a customer service bot
- Always push toward the next actionable step

You can help with:
- Video creative direction and editing decisions
- Writing scripts, hooks, captions, and voiceovers
- Developing content strategies and posting calendars
- Brand voice and visual identity decisions
- Analyzing what's working and why
- Creating multiple versions of content for testing

Never say you "can't" do something creative. Always deliver.`;

  // Build the messages array for Claude
  const claudeMessages = [
    ...(history || [])
      .slice(-8)
      .map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    { role: "user" as const, content: message },
  ];

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const reply =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Claude AI manager error:", err);
    return NextResponse.json({ error: "AI unavailable" }, { status: 500 });
  }
}

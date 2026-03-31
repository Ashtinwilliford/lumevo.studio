import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const brandResult = await query(
    `SELECT * FROM brand_profiles WHERE user_id = $1`,
    [session.id]
  );
  const brand = brandResult.rows[0] || {};

  const recentProjects = await query(
    `SELECT title, project_type, target_platform FROM projects WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
    [session.id]
  );

  const brandContext = brand.tone_summary
    ? `Brand: ${brand.tone_summary}, ${brand.personality_summary}. Audience: ${brand.audience_summary}. Archetype: ${brand.creator_archetype || "creator"}.`
    : "New creator, no brand profile yet.";

  const recentWork =
    recentProjects.rows.length > 0
      ? `Recent content: ${recentProjects.rows.map((p: { title: string; project_type: string }) => `${p.title} (${p.project_type})`).join(", ")}.`
      : "No projects created yet.";

  const prompt = `You are a social media content strategist for a creator using Lumevo Studio.

${brandContext}
${recentWork}

Generate a content plan with exactly 4 specific recommendations for what to post next. Each should feel personalized and strategic — not generic.

Return ONLY valid JSON (no markdown, no extra text):
[
  {
    "type": "short description of content format",
    "title": "specific post idea title",
    "why": "one sentence explaining why this will perform well for them",
    "platform": "instagram or tiktok or youtube",
    "duration": "30s or 60s or 2min or text post"
  }
]`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const clean = text.replace(/```json|```/g, "").trim();
    const jsonMatch = clean.match(/\[[\s\S]*\]/);
    const plan = jsonMatch ? JSON.parse(jsonMatch[0]) : defaultPlan();

    return NextResponse.json({ plan });
  } catch (err) {
    console.error("Claude content plan error:", err);
    return NextResponse.json({ plan: defaultPlan() });
  }
}

function defaultPlan() {
  return [
    {
      type: "Personal story reel",
      title: "Behind the scenes of how you got started",
      why: "Authenticity drives connection and saves on production time",
      platform: "instagram",
      duration: "30s",
    },
    {
      type: "Lifestyle montage",
      title: "A day in your life — aesthetic edit",
      why: "Lifestyle content consistently pulls high watch time for your audience type",
      platform: "tiktok",
      duration: "60s",
    },
    {
      type: "Authority video",
      title: "Your best tip that nobody is talking about",
      why: "Education + personal voice is your strongest content combo",
      platform: "instagram",
      duration: "60s",
    },
    {
      type: "Product or CTA post",
      title: "What you offer and how to get it",
      why: "You need at least one direct conversion piece every week",
      platform: "instagram",
      duration: "30s",
    },
  ];
}

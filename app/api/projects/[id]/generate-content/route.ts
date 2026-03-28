import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

const OPENAI_BASE = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { content_type, platform, style_strength } = body;

  const projectResult = await query(
    `SELECT * FROM projects WHERE id = $1 AND user_id = $2`,
    [id, session.id]
  );
  if (!projectResult.rows[0]) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const project = projectResult.rows[0];

  const brandResult = await query(`SELECT * FROM brand_profiles WHERE user_id = $1`, [session.id]);
  const brand = brandResult.rows[0] || {};

  const styleInstruction = brand.tone_summary
    ? `Write in this style: ${brand.tone_summary}. Personality: ${brand.personality_summary || "authentic"}. Target audience: ${brand.audience_summary || "general"}.`
    : "Write in an engaging, creator-focused style.";

  const typePrompts: Record<string, string> = {
    caption: `Write a punchy, engaging ${platform || "social media"} caption. Use line breaks for readability. Include 3-5 relevant hashtags at the end.`,
    hook: `Write 3 powerful opening hooks for a ${platform || "social media"} video. Each hook should be 1-2 sentences that stop the scroll immediately. Number them 1, 2, 3.`,
    script: `Write a full ${project.target_duration ? `${project.target_duration}-second` : "short"} video script for ${platform || "social media"}. Include [HOOK], [BODY], and [CTA] sections.`,
    post: `Write a compelling long-form ${platform || "social media"} post. Include a strong opening line, valuable content, and a clear call to action.`,
    ideas: `Generate 5 unique content ideas based on this prompt. For each idea include: title, format, and a brief description. Number them 1-5.`,
  };

  const typeKey = content_type || "caption";
  const prompt = `${styleInstruction}

Topic/Prompt: ${project.prompt_text || project.title}
Platform: ${platform || "general"}
Style strength: ${style_strength || 80}% personalized.

${typePrompts[typeKey] || typePrompts.caption}`;

  try {
    const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are Lumevo, an expert AI social media manager. You write content that sounds exactly like the creator — not generic, not robotic. Every word should feel authentic and platform-native." },
          { role: "user", content: prompt },
        ],
        temperature: 0.85,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI error:", err);
      return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
    }

    const data = await response.json();
    const generated_text = data.choices[0].message.content;

    const saved = await query(
      `INSERT INTO generated_contents (user_id, project_id, content_type, prompt_used, generated_text)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, content_type, generated_text, created_at`,
      [session.id, id, typeKey, project.prompt_text, generated_text]
    );

    await query(`UPDATE projects SET status = 'completed', updated_at = NOW() WHERE id = $1`, [id]);
    await query(
      `UPDATE brand_profiles SET generation_count = generation_count + 1, updated_at = NOW() WHERE user_id = $1`,
      [session.id]
    );

    return NextResponse.json({ content: saved.rows[0] });
  } catch (err) {
    console.error("Content generation error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

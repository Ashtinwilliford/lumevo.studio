import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// GET: Fetch user's creator style profile
export async function GET() {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await query("SELECT * FROM creator_styles WHERE user_id = $1", [session.id]);
  if (result.rows[0]) {
    return NextResponse.json({ style: result.rows[0] });
  }

  // Create default profile if none exists
  const insert = await query(
    `INSERT INTO creator_styles (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [session.id]
  );
  return NextResponse.json({ style: insert.rows[0] || {} });
}

// PATCH: Update style profile fields
// Elite feature: if `interpret_style: true` + `style_prompt`, Claude interprets
// the user's natural-language description into concrete style settings.
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // ── Elite: AI-driven style interpretation ──────────────────────────────
  if (body.interpret_style && body.style_prompt) {
    const prompt = body.style_prompt as string;
    try {
      const completion = await ai.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 400,
        temperature: 0.3,
        messages: [{
          role: "user",
          content: `You are a creative director. A user described their ideal video style:

"${prompt}"

Convert this into concrete video editing settings. Return ONLY this JSON:
{
  "color_grade": "warm" or "cool" or "natural" or "dramatic",
  "pacing": "slow" or "medium" or "fast",
  "music_energy": one of: "cinematic", "ambient", "energetic", "upbeat", "cinematic emotional", "trendy",
  "caption_style": "minimal" or "bold" or "conversational" or "descriptive",
  "text_amount": "none" or "minimal" or "moderate",
  "transition_density": "smooth" or "fast" or "minimal",
  "voiceover_preference": "none" or "ai" or "natural"
}`,
        }],
      });

      const raw = completion.content[0]?.type === "text" ? completion.content[0].text : "{}";
      const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
      const interpreted = JSON.parse(cleaned) as Record<string, string>;

      // Save both the interpreted settings AND the original prompt
      const allowed = [
        "color_grade", "pacing", "caption_style", "music_energy",
        "transition_density", "voiceover_preference", "text_amount",
      ];

      const updates: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      for (const key of allowed) {
        if (interpreted[key]) {
          updates.push(`${key} = $${i++}`);
          values.push(interpreted[key]);
        }
      }

      // Store the original prompt for display
      updates.push(`style_prompt = $${i++}`);
      values.push(prompt);

      updates.push(`updated_at = now()`);
      values.push(session.id);

      await query(
        `INSERT INTO creator_styles (user_id) VALUES ($${i})
         ON CONFLICT (user_id) DO UPDATE SET ${updates.join(", ")}`,
        values
      );

      const result = await query("SELECT * FROM creator_styles WHERE user_id = $1", [session.id]);
      return NextResponse.json({ style: result.rows[0], interpreted });
    } catch (err) {
      console.error("Style interpretation failed:", err);
      return NextResponse.json({ error: "Could not interpret style" }, { status: 500 });
    }
  }

  // ── Standard preset-based update ──────────────────────────────────────
  const allowed = [
    "vibe_keywords", "pacing", "caption_style", "music_energy",
    "transition_density", "voiceover_preference", "preferred_hooks",
    "banned_elements", "color_grade", "text_amount"
  ];

  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates.push(`${key} = $${i++}`);
      values.push(body[key]);
    }
  }

  if (updates.length === 0) return NextResponse.json({ ok: true });

  updates.push(`updated_at = now()`);
  values.push(session.id);

  // Upsert
  await query(
    `INSERT INTO creator_styles (user_id) VALUES ($${i})
     ON CONFLICT (user_id) DO UPDATE SET ${updates.join(", ")}`,
    values
  );

  const result = await query("SELECT * FROM creator_styles WHERE user_id = $1", [session.id]);
  return NextResponse.json({ style: result.rows[0] });
}

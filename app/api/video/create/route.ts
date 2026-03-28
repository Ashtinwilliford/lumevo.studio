import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import OpenAI from "openai";
import { ReplitConnectors } from "@replit/connectors-sdk";

const client = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, uploadIds, platform, duration } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const userId = session.id;

  const brandRows = await query("SELECT * FROM brand_profiles WHERE user_id = $1", [userId]);
  const brand = brandRows.rows[0];

  const userRows = await query("SELECT name, elevenlabs_voice_id FROM users WHERE id = $1", [userId]);
  const user = userRows.rows[0];

  let mediaContext = "";
  if (uploadIds?.length > 0) {
    const placeholders = uploadIds.map((_: string, i: number) => `$${i + 2}`).join(", ");
    const uploadRows = await query(
      `SELECT file_name, file_type, transcript_text, extracted_metadata FROM uploads WHERE user_id = $1 AND id IN (${placeholders})`,
      [userId, ...uploadIds]
    );
    mediaContext = uploadRows.rows
      .map((u: { file_name: string; file_type: string; transcript_text: string; extracted_metadata: Record<string, unknown> }) => {
        const meta = u.extracted_metadata ? JSON.stringify(u.extracted_metadata).slice(0, 200) : "";
        const transcript = u.transcript_text ? u.transcript_text.slice(0, 300) : "";
        return `[${u.file_type.toUpperCase()}: ${u.file_name}]${transcript ? ` — "${transcript}"` : ""}${meta ? ` Metadata: ${meta}` : ""}`;
      })
      .join("\n");
  } else {
    const allUploads = await query(
      "SELECT file_name, file_type, transcript_text FROM uploads WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10",
      [userId]
    );
    mediaContext = allUploads.rows
      .map((u: { file_name: string; file_type: string; transcript_text: string }) =>
        `[${u.file_type.toUpperCase()}: ${u.file_name}]${u.transcript_text ? ` — "${u.transcript_text.slice(0, 200)}"` : ""}`
      )
      .join("\n");
  }

  const brandContext = brand
    ? `Voice style: ${brand.voice_style || "conversational"}\nTone: ${brand.tone_keywords?.join(", ") || "authentic, engaging"}\nNiche: ${brand.niche || "lifestyle"}\nAudience: ${brand.target_audience || "general"}`
    : "Conversational, authentic, engaging content.";

  const durationWords = { 30: 75, 60: 150, 120: 300, 180: 450 }[duration as number] || 75;
  const platformContext = { tiktok: "TikTok", instagram: "Instagram Reels", youtube: "YouTube Shorts", general: "short-form video" }[platform as string] || "short-form video";

  const systemPrompt = `You are a video scriptwriter for ${user?.name || "a creator"} on ${platformContext}.

Brand Voice:
${brandContext}

Media included in this video:
${mediaContext || "(No specific media selected — write based on brand voice)"}

Write a ${durationWords}-word voiceover script for a ${duration}-second ${platformContext} video titled: "${title}"

Rules:
- Write in first person, as the creator speaking
- Hook in the first 3 seconds — make it impossible to scroll past
- Sound natural, like you're talking to a friend
- No em-dashes (—), use commas or periods
- No hashtags, no "hey guys", no "smash that like button"
- End with a natural, low-pressure CTA
- Format: clean paragraphs, no stage directions, just the spoken words`;

  const captionPrompt = `You are a social media caption writer for ${user?.name || "a creator"} on ${platformContext}.

Brand Voice:
${brandContext}

Write ONE punchy caption for a ${duration}-second video titled: "${title}"
- 2-3 sentences max
- Hook in the first line
- Sound like a real person, not a brand
- Include 3-5 relevant hashtags at the end
- No em-dashes, no "hey guys"

Respond with ONLY the caption text including hashtags. Nothing else.`;

  const [completion, captionCompletion] = await Promise.all([
    client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: systemPrompt }],
      max_tokens: 500,
      temperature: 0.8,
    }),
    client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: captionPrompt }],
      max_tokens: 150,
      temperature: 0.85,
    }),
  ]);

  const script = completion.choices[0]?.message?.content?.trim() || "";
  const caption = captionCompletion.choices[0]?.message?.content?.trim() || "";

  const projectRows = await query(
    `INSERT INTO projects (user_id, title, project_type, target_platform, target_duration, prompt_text, status, generated_content)
     VALUES ($1, $2, 'video', $3, $4, $5, 'scripting', $6) RETURNING id`,
    [userId, title, platform || "tiktok", duration || 30, title, JSON.stringify({ script })]
  );
  const projectId = projectRows.rows[0]?.id;

  if (uploadIds?.length > 0) {
    for (const uploadId of uploadIds) {
      await query("UPDATE uploads SET project_id = $1 WHERE id = $2 AND user_id = $3", [projectId, uploadId, userId]);
    }
  }

  let audioBase64: string | null = null;
  const voiceId = user?.elevenlabs_voice_id;

  if (voiceId && script) {
    try {
      const connectors = new ReplitConnectors();
      const res = await connectors.proxy("elevenlabs", `/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        }),
      });

      if (res.ok) {
        const buf = await res.arrayBuffer();
        audioBase64 = Buffer.from(buf).toString("base64");

        await query(
          `INSERT INTO voiceovers (user_id, project_id, script_content, provider, provider_voice_id, status)
           VALUES ($1, $2, $3, 'elevenlabs', $4, 'completed')`,
          [userId, projectId, script, voiceId]
        );

        await query("UPDATE projects SET status = 'completed' WHERE id = $1", [projectId]);
      }
    } catch (e) {
      console.error("ElevenLabs synthesis error:", e);
    }
  } else {
    await query("UPDATE projects SET status = 'scripted' WHERE id = $1", [projectId]);
  }

  return NextResponse.json({ projectId, script, caption, audioBase64, hasVoice: !!voiceId });
}

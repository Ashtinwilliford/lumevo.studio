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

  const { title, uploadIds, platform, duration, vibe, useVoiceClone } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const userId = session.id;

  const [brandRows, userRows] = await Promise.all([
    query("SELECT * FROM brand_profiles WHERE user_id = $1", [userId]),
    query("SELECT name, elevenlabs_voice_id, subscription_tier FROM users WHERE id = $1", [userId]),
  ]);
  const brand = brandRows.rows[0] as Record<string, unknown> | undefined;
  const user = userRows.rows[0] as Record<string, unknown> | undefined;

  if (user?.subscription_tier === "trial") {
    const countRes = await query("SELECT COUNT(*) AS cnt FROM projects WHERE user_id = $1", [userId]);
    const projectCount = parseInt((countRes.rows[0] as { cnt: string })?.cnt || "0");
    if (projectCount >= 2) {
      return NextResponse.json({ error: "Trial limit reached. Upgrade to create more projects.", trialLimitReached: true }, { status: 403 });
    }
  }

  const platformContext = { tiktok: "TikTok", instagram: "Instagram Reels", youtube: "YouTube Shorts", general: "short-form video" }[platform as string] || "short-form video";
  const durationWords = { 15: 40, 30: 75, 60: 150, 120: 300, 180: 450 }[duration as number] || 75;

  // === 1. MEDIA CONTEXT from selected uploads ===
  let mediaContext = "";
  if (uploadIds?.length > 0) {
    const placeholders = uploadIds.map((_: string, i: number) => `$${i + 2}`).join(", ");
    const uploadRows = await query(
      `SELECT file_name, file_type, transcript_text, extracted_metadata FROM uploads WHERE user_id = $1 AND id IN (${placeholders})`,
      [userId, ...uploadIds]
    );
    mediaContext = uploadRows.rows
      .map((u: Record<string, unknown>) => {
        const transcript = typeof u.transcript_text === "string" ? u.transcript_text.slice(0, 500) : "";
        return `[${String(u.file_type).toUpperCase()}: ${u.file_name}]${transcript ? `\nTranscript: "${transcript}"` : ""}`;
      })
      .join("\n\n");
  }

  // === 2. FEW-SHOT EXAMPLES from past uploads (voice learning) ===
  const exampleUploads = await query(
    `SELECT file_type, transcript_text FROM uploads
     WHERE user_id = $1 AND transcript_text IS NOT NULL AND transcript_text != ''
     AND ($2::uuid[] IS NULL OR id != ALL($2::uuid[]))
     ORDER BY created_at DESC LIMIT 5`,
    [userId, uploadIds?.length > 0 ? uploadIds : null]
  );
  const voiceExamples = (exampleUploads.rows as Record<string, unknown>[])
    .filter(u => typeof u.transcript_text === "string" && (u.transcript_text as string).length > 50)
    .map((u, i) => `Example ${i + 1} (${u.file_type}): "${(u.transcript_text as string).slice(0, 300).trim()}"`)
    .join("\n");

  // === 3. BRAND CONTEXT — full personality injection ===
  const brand2 = brand as Record<string, unknown> | undefined;
  const hasBrand = !!(brand2?.tone_summary || brand2?.personality_summary || brand2?.voice_preferences);

  const brandLines: string[] = [];
  if (brand2?.tone_summary) brandLines.push(`Tone: ${brand2.tone_summary}`);
  if (brand2?.personality_summary) brandLines.push(`Personality: ${brand2.personality_summary}`);
  if (brand2?.audience_summary) brandLines.push(`Audience: ${brand2.audience_summary}`);
  if (brand2?.voice_preferences) brandLines.push(`Voice style: ${brand2.voice_preferences}`);
  if (brand2?.pacing_style) brandLines.push(`Pacing: ${brand2.pacing_style}`);
  if (brand2?.cta_style) brandLines.push(`CTA style: ${brand2.cta_style}`);
  if (brand2?.visual_style_summary) brandLines.push(`Visual style: ${brand2.visual_style_summary}`);

  // Personality system additions
  const hookStyle = (brand2?.hook_style as string) || null;
  const patternInterrupt = (brand2?.pattern_interrupt_style as string) || null;
  const emotionalArc = (brand2?.emotional_arc_preference as string) || null;
  const creatorArchetype = (brand2?.creator_archetype as string) || null;

  const brandContext = hasBrand
    ? brandLines.join("\n")
    : "Conversational, authentic, and direct — sounds like a real person talking to a friend.";

  const creatorName = (user?.name as string) || "a creator";

  // Fetch recent positive feedback signals for this creator
  const feedbackRows = await query(
    `SELECT insight_data FROM learning_insights WHERE user_id = $1
     AND insight_type = 'positive_style_signal'
     ORDER BY created_at DESC LIMIT 3`,
    [userId]
  );
  const positiveFeedback = (feedbackRows.rows as { insight_data: Record<string, unknown> }[])
    .map(r => r.insight_data?.meaning as string)
    .filter(Boolean)
    .join("; ");

  // === 4. SCRIPT PROMPT — personality-driven ===
  const vibeInstruction = vibe
    ? `\nVibe: "${vibe}" — this defines the emotional temperature of every line.`
    : "";

  const examplesSection = voiceExamples
    ? `\nReal samples of how ${creatorName} actually speaks:\n${voiceExamples}\n`
    : "";

  const mediaSection = mediaContext
    ? `\nMedia context:\n${mediaContext}\n`
    : "";

  const personalityAdditions = [
    hookStyle && `HOOK STYLE (use this exact approach for the opener): ${hookStyle}`,
    emotionalArc && `EMOTIONAL ARC (script should follow this journey): ${emotionalArc}`,
    patternInterrupt && `PATTERN INTERRUPT (include this technique mid-script): ${patternInterrupt}`,
    creatorArchetype && `CREATOR ARCHETYPE (write from this perspective): ${creatorArchetype}`,
    positiveFeedback && `WHAT WORKED BEFORE (lean into this): ${positiveFeedback}`,
  ].filter(Boolean).join("\n");

  const scriptPrompt = `You are writing a voiceover script for ${creatorName}. Sound EXACTLY like them — not generic.

BRAND VOICE:
${brandContext}
${vibeInstruction}

PERSONALITY SYSTEM (this is what makes them unique — apply all of it):
${personalityAdditions || "Build from the brand voice and vibe above."}

${examplesSection}${mediaSection}
Write a ${durationWords}-word spoken script for a ${duration}-second ${platformContext} video.
Topic: "${title}"

RULES:
- First sentence = the hook. Follow the hook style above precisely. Make it impossible to scroll past.
- Write in first person as ${creatorName}. Match their vocabulary, rhythm, and sentence length exactly.
- Follow the emotional arc — take the viewer on the journey described above
- If a pattern interrupt technique is listed, weave it into the middle of the script naturally
- No em-dashes. Use commas, periods, or short breaks
- No "hey guys", no "smash that like button", no hollow phrases
- End with a natural, low-pressure CTA that fits the vibe
- Just the words — no labels, no stage directions
- Exactly ${durationWords} words`;

  // === 5. CAPTION PROMPT ===
  const captionPrompt = `You are writing a social media caption for ${creatorName} on ${platformContext}.

${brandContext}
${vibeInstruction}
${examplesSection}
Write ONE caption for a ${duration}-second ${platformContext} video titled: "${title}"

Rules:
- First line is the hook — make it impossible not to read the rest
- 2-3 sentences total
- Sound like a real person texting a friend, not a brand posting content
- Match the vibe: ${vibe || "authentic and engaging"}
- Include 3-5 relevant hashtags at the very end
- No em-dashes, no "hey guys", no hollow phrases like "love this" or "so excited"

Respond with ONLY the caption text and hashtags. No labels, no quotes around it.`;

  const [completion, captionCompletion] = await Promise.all([
    client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: scriptPrompt }],
      max_tokens: 600,
      temperature: 0.82,
    }),
    client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: captionPrompt }],
      max_tokens: 180,
      temperature: 0.87,
    }),
  ]);

  const script = completion.choices[0]?.message?.content?.trim() || "";
  const caption = captionCompletion.choices[0]?.message?.content?.trim() || "";

  const projectRows = await query(
    `INSERT INTO projects (user_id, title, project_type, target_platform, target_duration, prompt_text, status, generated_content)
     VALUES ($1, $2, 'video', $3, $4, $5, 'scripting', $6) RETURNING id`,
    [userId, title, platform || "tiktok", duration || 30, title, JSON.stringify({ script, caption, vibe })]
  );
  const projectId = projectRows.rows[0]?.id;

  if (uploadIds?.length > 0) {
    for (const uploadId of uploadIds) {
      await query("UPDATE uploads SET project_id = $1 WHERE id = $2 AND user_id = $3", [projectId, uploadId, userId]);
    }
  }

  let audioBase64: string | null = null;
  const voiceId = user?.elevenlabs_voice_id as string | undefined;

  if (voiceId && script && useVoiceClone !== false) {
    try {
      const connectors = new ReplitConnectors();
      const res = await connectors.proxy("elevenlabs", `/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.4, use_speaker_boost: true },
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

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import OpenAI from "openai";

export const maxDuration = 60;

const ai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface BrandProfile {
  tone_summary: string | null;
  personality_summary: string | null;
  audience_summary: string | null;
  visual_style_summary: string | null;
  pacing_style: string | null;
  voice_preferences: string | null;
  music_preferences: string | null;
  hook_style: string | null;
  pattern_interrupt_style: string | null;
  emotional_arc_preference: string | null;
  music_genre_preference: string | null;
  creator_archetype: string | null;
  confidence_score: number;
  learning_progress_percent: number;
  feedback_summary: Record<string, number> | null;
  generation_count: number;
  upload_count: number;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trigger } = await req.json().catch(() => ({ trigger: "manual" })) as { trigger?: string };
  const userId = session.id;

  // Gather all learning data sources
  const [
    uploadsRows,
    projectsRows,
    feedbackRows,
    insightsRows,
    brandRows,
    userRows,
  ] = await Promise.all([
    query(
      `SELECT file_name, file_type, ai_analysis, transcript_text, video_duration_sec, created_at
       FROM uploads WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    ),
    query(
      `SELECT title, target_platform, vibe, target_duration, generated_content,
              timeline, status, created_at
       FROM projects WHERE user_id = $1 ORDER BY created_at DESC LIMIT 15`,
      [userId]
    ),
    query(
      `SELECT action, COUNT(*) as cnt
       FROM project_feedback WHERE user_id = $1 GROUP BY action`,
      [userId]
    ),
    query(
      `SELECT insight_type, insight_data, confidence
       FROM learning_insights WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 30`,
      [userId]
    ),
    query("SELECT * FROM brand_profiles WHERE user_id = $1", [userId]),
    query("SELECT name, created_at FROM users WHERE id = $1", [userId]),
  ]);

  const currentBrand = brandRows.rows[0] as BrandProfile | undefined;
  const user = userRows.rows[0] as { name: string; created_at: string } | undefined;
  const uploads = uploadsRows.rows as Record<string, unknown>[];
  const projects = projectsRows.rows as Record<string, unknown>[];
  const feedbackSummary = feedbackRows.rows as { action: string; cnt: string }[];
  const insights = insightsRows.rows as Record<string, unknown>[];

  // Summarize clip analysis from uploads
  const clipAnalyses = uploads
    .filter(u => u.ai_analysis)
    .map(u => {
      const a = u.ai_analysis as Record<string, string>;
      return `${u.file_type === "video" ? "Video" : "Image"} "${u.file_name}": energy=${a.energy}, vibe=${a.vibe}, bestUse=${a.bestUse}, description="${(a.description || "").slice(0, 80)}"`;
    })
    .join("\n");

  const transcripts = uploads
    .filter(u => u.transcript_text)
    .map(u => `From "${u.file_name}": "${String(u.transcript_text || "").slice(0, 200)}"`)
    .join("\n");

  const pastProjects = projects
    .map(p => {
      const gc = p.generated_content as Record<string, string> | null;
      return `"${p.title}" on ${p.target_platform} · ${p.target_duration}s · vibe="${p.vibe}" · script="${(gc?.script || "").slice(0, 150)}"`;
    })
    .join("\n");

  const feedbackStr = feedbackSummary
    .map(f => `${f.action}: ${f.cnt} times`)
    .join(", ");

  const positiveInsights = insights
    .filter(i => i.insight_type === "positive_style_signal")
    .map(i => {
      const d = i.insight_data as Record<string, unknown>;
      return `Loved: ${d.vibe} on ${d.platform}`;
    })
    .join("; ");

  const negativeInsights = insights
    .filter(i => i.insight_type === "negative_style_signal")
    .map(i => {
      const d = i.insight_data as Record<string, unknown>;
      return `Disliked: ${d.vibe} on ${d.platform}`;
    })
    .join("; ");

  const dataRichness =
    uploads.length + projects.length + feedbackSummary.reduce((a, f) => a + parseInt(f.cnt), 0);

  // === Run deep personality analysis with GPT-4o ===
  const learnPrompt = `You are a master creator coach and AI learning system for a content creator named ${user?.name || "Creator"}.

Your job: analyze ALL of their uploaded content, generated videos, and feedback patterns to build a deep, specific personality profile that will make every future video feel EXACTLY like their authentic style.

=== THEIR UPLOADED CONTENT ===
${clipAnalyses || "No clips analyzed yet."}

=== WHAT THEY SAY IN THEIR CONTENT ===
${transcripts || "No transcripts yet."}

=== PAST VIDEOS THEY CREATED ===
${pastProjects || "No projects yet."}

=== HOW THEY RESPONDED TO OUTPUTS ===
${feedbackStr || "No feedback yet."}

=== WHAT THEY LOVED ===
${positiveInsights || "Not enough data yet."}

=== WHAT THEY REJECTED ===
${negativeInsights || "Not enough data yet."}

=== CURRENT PROFILE (update or refine these) ===
Tone: ${currentBrand?.tone_summary || "unknown"}
Personality: ${currentBrand?.personality_summary || "unknown"}
Audience: ${currentBrand?.audience_summary || "unknown"}
Hook style: ${currentBrand?.hook_style || "unknown"}
Pacing: ${currentBrand?.pacing_style || "unknown"}
Archetype: ${currentBrand?.creator_archetype || "unknown"}

Based on ALL this evidence, return a JSON object with these exact fields:

{
  "tone_summary": "3-sentence description of their specific communication tone — how they actually talk, not generic labels",
  "personality_summary": "3 specific personality traits with HOW they show up in content (e.g. 'self-deprecating humor — makes jokes at their own expense before delivering the value')",
  "audience_summary": "Specific audience description with what they care about, age range estimate, what keeps them watching",
  "visual_style_summary": "Their visual aesthetic — lighting preference, shooting style, pace of cuts, what their content looks like",
  "pacing_style": "Specific pacing description — how fast do cuts happen, do they build slowly or jump into action, average clip length that feels right",
  "voice_preferences": "How they write narration — sentence length, vocabulary level, use of slang, phrases they repeat",
  "hook_style": "SPECIFIC first-3-seconds hook pattern they use or should use (e.g. 'open with a shocking statement then immediately cut to evidence', 'start mid-action with no intro')",
  "pattern_interrupt_style": "Techniques to break viewer autopilot — what visual or audio changes work for their content",
  "emotional_arc_preference": "The emotional journey their best content takes — what feeling does it start with, where does it peak, how does it end",
  "music_genre_preference": "Which music style fits their content best and why (be specific: 'lo-fi hip hop at 85-90 BPM because their content is reflective and personal')",
  "creator_archetype": "One of: educator|entertainer|inspirational|storyteller|documenter|provocateur",
  "confidence_score": <integer 0-100 based on how much data you have — increase with more uploads, projects, and feedback>,
  "learning_progress_percent": <integer 0-100>,
  "key_insight": "The single most important thing you learned about how to make their videos better"
}

Be SPECIFIC. Do not use generic phrases like "engaging content" or "authentic voice." Give real, actionable descriptions based on evidence.`;

  let learned: Record<string, unknown> = {};
  try {
    const res = await ai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1200,
      temperature: 0.4,
      messages: [{ role: "user", content: learnPrompt }],
      response_format: { type: "json_object" },
    });
    learned = JSON.parse(res.choices[0]?.message?.content || "{}") as Record<string, unknown>;
  } catch (err) {
    console.error("Brand learning GPT error:", err);
  }

  if (!learned.tone_summary) {
    return NextResponse.json({ updated: false, reason: "Not enough data to learn yet" });
  }

  // Compute confidence based on data richness
  const rawConfidence = Math.min(
    100,
    Math.round(
      (typeof learned.confidence_score === "number" ? learned.confidence_score : 30) +
      Math.min(20, uploads.length * 2) +
      Math.min(15, projects.length * 3) +
      Math.min(15, dataRichness)
    )
  );
  const confidence = Math.min(100, rawConfidence);
  const progress = Math.min(100, Math.round(confidence * 0.9 + (projects.length >= 5 ? 10 : 0)));

  // Save insight record
  if (learned.key_insight) {
    await query(
      `INSERT INTO learning_insights (user_id, insight_type, insight_data, confidence, source)
       VALUES ($1, 'deep_analysis', $2, $3, 'brand_learn')`,
      [userId, JSON.stringify({ insight: learned.key_insight, trigger }), confidence / 100]
    );
  }

  // Upsert brand profile with all learned data
  await query(
    `INSERT INTO brand_profiles (
       user_id, tone_summary, personality_summary, audience_summary,
       visual_style_summary, pacing_style, voice_preferences, music_preferences,
       hook_style, pattern_interrupt_style, emotional_arc_preference,
       music_genre_preference, creator_archetype,
       confidence_score, learning_progress_percent,
       upload_count, generation_count, last_learned_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now())
     ON CONFLICT (user_id) DO UPDATE SET
       tone_summary = EXCLUDED.tone_summary,
       personality_summary = EXCLUDED.personality_summary,
       audience_summary = EXCLUDED.audience_summary,
       visual_style_summary = EXCLUDED.visual_style_summary,
       pacing_style = EXCLUDED.pacing_style,
       voice_preferences = EXCLUDED.voice_preferences,
       music_preferences = EXCLUDED.music_preferences,
       hook_style = EXCLUDED.hook_style,
       pattern_interrupt_style = EXCLUDED.pattern_interrupt_style,
       emotional_arc_preference = EXCLUDED.emotional_arc_preference,
       music_genre_preference = EXCLUDED.music_genre_preference,
       creator_archetype = EXCLUDED.creator_archetype,
       confidence_score = EXCLUDED.confidence_score,
       learning_progress_percent = EXCLUDED.learning_progress_percent,
       upload_count = EXCLUDED.upload_count,
       generation_count = EXCLUDED.generation_count,
       last_learned_at = now(),
       updated_at = now()`,
    [
      userId,
      learned.tone_summary, learned.personality_summary, learned.audience_summary,
      learned.visual_style_summary, learned.pacing_style, learned.voice_preferences,
      learned.music_genre_preference, // music_preferences
      learned.hook_style, learned.pattern_interrupt_style, learned.emotional_arc_preference,
      learned.music_genre_preference,
      learned.creator_archetype || "creator",
      confidence, progress,
      uploads.length, projects.length,
    ]
  );

  return NextResponse.json({
    updated: true,
    confidence,
    progress,
    archetype: learned.creator_archetype,
    keyInsight: learned.key_insight,
    trigger,
  });
}

export async function GET() {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brandRows = await query("SELECT * FROM brand_profiles WHERE user_id = $1", [session.id]);
  const brand = brandRows.rows[0] || null;

  const insightRows = await query(
    `SELECT insight_data, confidence, created_at
     FROM learning_insights WHERE user_id = $1 AND insight_type = 'deep_analysis'
     ORDER BY created_at DESC LIMIT 5`,
    [session.id]
  );

  return NextResponse.json({ brand, insights: insightRows.rows });
}

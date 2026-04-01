import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { logStage } from "@/lib/genlog";

export const maxDuration = 60;

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface CreatorStyle {
  vibe_keywords: string[];
  pacing: string;
  caption_style: string;
  music_energy: string;
  transition_density: string;
  voiceover_preference: string;
  preferred_hooks: string[];
  banned_elements: string[];
  color_grade: string;
  text_amount: string;
}

interface ClipInfo {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  video_duration_sec: number | null;
  ai_analysis: Record<string, unknown> | null;
}

interface SceneItem {
  clip_id: string;
  reason_selected: string;
  start_trim_sec: number;
  end_trim_sec: number;
  overlay_text: string;
  transition_after: string;
  beat_emphasis: string;
}

interface VideoPlan {
  video_concept: string;
  target_emotion: string;
  opening_hook: string;
  music_brief: string;
  voiceover_needed: boolean;
  voiceover_script: string;
  caption_style_rules: string[];
  scene_order: SceneItem[];
  ending: string;
  exclude_clip_ids: string[];
  editor_notes: string[];
}

// POST: Generate a structured video plan using Claude
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const { projectId } = body;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const userId = session.id;
  const startTime = Date.now();

  try {
    // Load project
    const projectRes = await query(
      "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
      [projectId, userId]
    );
    const project = projectRes.rows[0];
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Load creator style
    const styleRes = await query("SELECT * FROM creator_styles WHERE user_id = $1", [userId]);
    let style = styleRes.rows[0] as unknown as CreatorStyle | undefined;
    if (!style) {
      await query("INSERT INTO creator_styles (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [userId]);
      const s2 = await query("SELECT * FROM creator_styles WHERE user_id = $1", [userId]);
      style = s2.rows[0] as unknown as CreatorStyle;
    }

    // Load clips for this project
    const clipRes = await query(
      `SELECT id, file_name, file_type, file_path, video_duration_sec, ai_analysis
       FROM uploads WHERE project_id = $1 AND user_id = $2 AND file_path IS NOT NULL
       ORDER BY created_at ASC`,
      [projectId, userId]
    );
    const clips = clipRes.rows as unknown as ClipInfo[];

    if (clips.length === 0) {
      return NextResponse.json({ error: "No media uploaded for this project." }, { status: 400 });
    }

    // Load past feedback for this user (helps Claude learn preferences)
    let pastFeedback = "";
    try {
      const feedbackRes = await query(
        `SELECT action, context FROM project_feedback WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [userId]
      );
      pastFeedback = feedbackRes.rows
        .map(f => `${f.action}: ${JSON.stringify(f.context)}`)
        .join("\n");
    } catch { /* table may not exist yet */ }

    // Build clip descriptions for Claude
    const clipDescriptions = clips.map((c, i) => {
      const a = c.ai_analysis || {};
      const dur = c.video_duration_sec;
      return [
        `Clip ${i + 1}: id="${c.id}"`,
        `type=${c.file_type}`,
        dur ? `duration=${dur.toFixed(1)}s` : "duration=unknown",
        `file="${c.file_name}"`,
        a.description ? `content="${a.description}"` : "",
        a.mood ? `mood=${a.mood}` : "",
        a.energy ? `energy=${a.energy}` : "",
        a.warmth_score ? `warmth=${a.warmth_score}/10` : "",
        a.has_speech ? "has_speech=yes" : "",
        a.has_laughter ? "has_laughter=yes" : "",
        a.has_natural_audio ? "has_natural_audio=yes" : "",
        a.best_use ? `best_use=${a.best_use}` : "",
      ].filter(Boolean).join(" | ");
    }).join("\n");

    const title = project.title as string;
    const vibe = project.vibe as string || style.vibe_keywords?.join(", ") || "cinematic";
    const platform = project.target_platform as string || "instagram";
    const targetDuration = (project.target_duration as number) || 30;

    // Rich brief fields (from project creation form)
    const scene = project.scene as string || "";
    const people = project.people as string || "";
    const location = project.location as string || "";
    const occasion = project.occasion as string || "";
    const tone = project.tone as string || "";
    const musicStyle = project.music_style as string || "";
    const voiceoverScript = project.voiceover_script as string || "";
    const textOverlays = (project.text_overlays as string[]) || [];

    const plannerPrompt = `You are the creative director for a premium short-form video editor.

Your job is to convert raw clips plus a creator style profile into a polished vertical video plan.

Think like a top influencer editor:
- strongest hook first
- fast elimination of weak clips
- emotional or stylish arc
- tasteful captions
- clear pacing
- music and visuals must feel intentional

=== PROJECT ===
Title: "${title}"
Platform: ${platform}
Target duration: ${targetDuration}s
Vibe: ${vibe}
${tone ? `Tone: ${tone}` : ""}
${scene ? `Scene: ${scene}` : ""}
${people ? `People: ${people}` : ""}
${location ? `Location: ${location}` : ""}
${occasion ? `Occasion: ${occasion}` : ""}
${musicStyle ? `Music style requested: ${musicStyle}` : ""}
${voiceoverScript ? `\nVOICEOVER SCRIPT (use this exact text for voiceover):\n"${voiceoverScript}"\n` : ""}
${textOverlays.length > 0 ? `\nTEXT OVERLAYS (place these on screen at appropriate moments):\n${textOverlays.map((t, i) => `${i + 1}. "${t}"`).join("\n")}\n` : ""}

=== CREATOR STYLE PROFILE ===
Vibe keywords: ${style.vibe_keywords?.join(", ") || "cinematic, warm"}
Pacing: ${style.pacing}
Caption style: ${style.caption_style}
Music energy: ${style.music_energy}
Transition density: ${style.transition_density}
Voiceover preference: ${style.voiceover_preference}
Preferred hooks: ${style.preferred_hooks?.join(", ") || "visual impact, question, bold statement"}
Banned elements: ${style.banned_elements?.join(", ") || "none"}
Color grade: ${style.color_grade}
Text amount: ${style.text_amount}

=== AVAILABLE CLIPS ===
${clipDescriptions}

${pastFeedback ? `=== PAST FEEDBACK (what the creator liked/disliked) ===\n${pastFeedback}\n` : ""}

=== RULES ===
- Choose only the strongest clips. Total scene durations must sum to ~${targetDuration}s
- For images: you control duration (3-6s works well)
- For videos: use start_trim_sec/end_trim_sec to pick best segment
- Favor visual variety - avoid repetitive shots
- Build momentum through the arc
- Keep text minimal unless style profile says otherwise
- Music must fit the target emotion and pacing
- If clips are weak, say so in editor_notes
- overlay_text should be empty string "" unless text is intentional and minimal
- transition_after: "crossfade" for smooth, "cut" for energy, "fade" for dramatic

Output ONLY this JSON (no markdown, no explanation):
{
  "video_concept": "",
  "target_emotion": "",
  "opening_hook": "",
  "music_brief": "",
  "voiceover_needed": false,
  "voiceover_script": "",
  "caption_style_rules": [],
  "scene_order": [
    {
      "clip_id": "",
      "reason_selected": "",
      "start_trim_sec": 0,
      "end_trim_sec": 0,
      "overlay_text": "",
      "transition_after": "",
      "beat_emphasis": ""
    }
  ],
  "ending": "",
  "exclude_clip_ids": [],
  "editor_notes": []
}`;

    // Call Claude with retry on malformed JSON
    let plan: VideoPlan | null = null;
    let attempts = 0;
    let lastError = "";

    while (!plan && attempts < 3) {
      attempts++;
      try {
        const completion = await ai.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 2000,
          temperature: 0.6,
          messages: [
            { role: "user", content: plannerPrompt },
            ...(lastError ? [{ role: "user" as const, content: `Your previous response was invalid JSON: ${lastError}. Please output ONLY valid JSON, no markdown.` }] : []),
          ],
        });

        const raw = completion.content[0]?.type === "text" ? completion.content[0].text : "";
        const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
        plan = JSON.parse(cleaned);

        // Validate required fields
        if (!plan?.scene_order?.length) throw new Error("No scenes in plan");
        if (!plan.video_concept) throw new Error("Missing video_concept");

        // Validate clip IDs exist
        const validIds = new Set(clips.map(c => c.id));
        for (const scene of plan.scene_order) {
          if (!validIds.has(scene.clip_id)) {
            throw new Error(`Invalid clip_id: ${scene.clip_id}`);
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Parse error";
        plan = null;
        console.error(`Plan attempt ${attempts} failed:`, lastError);
      }
    }

    if (!plan) {
      await logStage(projectId, userId, "claude_plan", { prompt: "..." }, null, `Failed after ${attempts} attempts: ${lastError}`, Date.now() - startTime);
      return NextResponse.json({ error: `AI planning failed: ${lastError}` }, { status: 500 });
    }

    // If user provided a voiceover script, use it directly (override AI's version)
    if (voiceoverScript) {
      plan.voiceover_needed = true;
      plan.voiceover_script = voiceoverScript;
    }

    // If user provided text overlays, inject them into first few scenes
    if (textOverlays.length > 0 && plan.scene_order?.length > 0) {
      textOverlays.forEach((text, i) => {
        if (plan.scene_order[i]) plan.scene_order[i].overlay_text = text;
      });
    }

    // Save plan to project (cast to jsonb explicitly for postgres driver compatibility)
    await query(
      `UPDATE projects SET claude_plan = $1::jsonb, status = 'planned', updated_at = now() WHERE id = $2`,
      [JSON.stringify(plan), projectId]
    );

    await logStage(projectId, userId, "claude_plan", { clipCount: clips.length, style: style.vibe_keywords }, plan, undefined, Date.now() - startTime);

    return NextResponse.json({ plan });
  } catch (err) {
    console.error("Plan error:", err);
    await logStage(projectId, userId, "claude_plan", {}, null, err instanceof Error ? err.message : "Unknown error", Date.now() - startTime);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Planning failed" }, { status: 500 });
  }
}

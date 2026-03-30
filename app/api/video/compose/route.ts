import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { writeFile, unlink, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { exec } from "child_process";
import { promisify } from "util";
import OpenAI from "openai";
import { ReplitConnectors } from "@replit/connectors-sdk";

export const maxDuration = 120;
const execAsync = promisify(exec);

const ai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const VIDEO_W = 1080;
const VIDEO_H = 1920;
const SCALE_PAD = `scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=decrease,pad=${VIDEO_W}:${VIDEO_H}:(ow-iw)/2:(oh-ih)/2:color=black`;

interface UploadRow {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string | null;
  ai_analysis: Record<string, string> | null;
  video_duration_sec: number | null;
}

interface BrandProfile {
  tone_summary: string | null;
  personality_summary: string | null;
  hook_style: string | null;
  pattern_interrupt_style: string | null;
  emotional_arc_preference: string | null;
  pacing_style: string | null;
  creator_archetype: string | null;
  avg_pacing_bpm: number | null;
}

interface TimelineClip {
  uploadId: string;
  trimStart: number;
  trimEnd: number;
  purpose: string;       // hook|build|peak|pattern_interrupt|cta|outro
  emotionTag: string;    // what the viewer should feel during this clip
  transitionStyle: string; // cut|fade|jump
}

interface MusicConfig {
  url: string;
  volumeUnderVoice: number;
  volumeNoVoice: number;
  fadeInSec: number;
  fadeOutSec: number;
}

async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`
    );
    return parseFloat(stdout.trim()) || 5;
  } catch {
    return 5;
  }
}

async function renderClip(
  upload: UploadRow,
  trimStart: number,
  trimEnd: number,
  outPath: string
): Promise<boolean> {
  const absPath = upload.file_path
    ? join(process.cwd(), "public", upload.file_path)
    : null;
  if (!absPath) return false;

  const dur = Math.max(0.5, trimEnd - trimStart);

  try {
    if (upload.file_type === "image") {
      // Ken Burns — slow zoom creates life and movement in stills
      const frames = Math.round(dur * 30);
      await execAsync(
        `ffmpeg -y -loop 1 -i "${absPath}" -t ${dur} ` +
        `-vf "${SCALE_PAD},zoompan=z='min(zoom+0.0006,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${VIDEO_W}x${VIDEO_H},fps=30" ` +
        `-an -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p "${outPath}"`,
        { timeout: 60000 }
      );
    } else {
      // Video — trim to selected segment
      const realDur = await getVideoDuration(absPath);
      const safeStart = Math.min(trimStart, Math.max(0, realDur - 1));
      const safeDur = Math.min(dur, realDur - safeStart);
      await execAsync(
        `ffmpeg -y -ss ${safeStart.toFixed(2)} -i "${absPath}" -t ${safeDur.toFixed(2)} ` +
        `-vf "${SCALE_PAD},fps=30" ` +
        `-an -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p "${outPath}"`,
        { timeout: 60000 }
      );
    }
    return true;
  } catch (err) {
    console.error(`Clip render failed (${upload.file_name}):`, err);
    return false;
  }
}

async function downloadMusicTrack(url: string, destPath: string): Promise<boolean> {
  try {
    await execAsync(`curl -sL --max-time 15 -o "${destPath}" "${url}"`, { timeout: 20000 });
    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${destPath}"`);
    return parseFloat(stdout.trim()) > 0;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    projectId, uploadIds, script, title, vibe, platform, duration,
    useVoiceClone, audioBase64, includeMusic,
  } = await req.json() as {
    projectId?: string;
    uploadIds: string[];
    script: string;
    title: string;
    vibe?: string;
    platform?: string;
    duration?: number;
    useVoiceClone?: boolean;
    audioBase64?: string | null;
    includeMusic?: boolean;
  };

  if (!uploadIds?.length || !script?.trim()) {
    return NextResponse.json({ error: "uploadIds and script required" }, { status: 400 });
  }

  const userId = session.id;
  const targetDuration = duration || 30;
  const tmpDir = tmpdir();
  const jobId = `compose_${userId.slice(0, 8)}_${Date.now()}`;
  const tempFiles: string[] = [];

  try {
    // === 1. Load all data sources ===
    const placeholders = uploadIds.map((_: string, i: number) => `$${i + 2}`).join(", ");
    const [uploadRows, brandRows, userRows, insightRows] = await Promise.all([
      query(
        `SELECT id, file_name, file_type, file_path, ai_analysis, video_duration_sec
         FROM uploads WHERE user_id = $1 AND id IN (${placeholders})`,
        [userId, ...uploadIds]
      ),
      query("SELECT * FROM brand_profiles WHERE user_id = $1", [userId]),
      query("SELECT name, elevenlabs_voice_id FROM users WHERE id = $1", [userId]),
      query(
        `SELECT insight_data FROM learning_insights WHERE user_id = $1
         AND insight_type IN ('positive_style_signal', 'deep_analysis')
         ORDER BY created_at DESC LIMIT 5`,
        [userId]
      ),
    ]);

    const uploads = uploadRows.rows as UploadRow[];
    const brand = brandRows.rows[0] as BrandProfile | undefined;
    const user = userRows.rows[0] as { name: string; elevenlabs_voice_id?: string };
    const insights = insightRows.rows as { insight_data: Record<string, unknown> }[];

    // === 2. Build creative brief for AI director ===
    const clipDescriptions = uploads
      .filter(u => u.file_path)
      .map(u => {
        const a = u.ai_analysis || {};
        const dur = u.video_duration_sec
          ? `${parseFloat(String(u.video_duration_sec)).toFixed(1)}s video`
          : "image (duration you control)";
        return [
          `ID: ${u.id}`,
          `File: ${u.file_name}`,
          `Type: ${dur}`,
          `AI Analysis: ${a.description || "not analyzed"}`,
          `Energy: ${a.energy || "unknown"} | Vibe: ${a.vibe || "unknown"} | Best for: ${a.bestUse || "any"}`,
          `Shot type: ${a.shotType || "?"} | Subject: ${a.subject || "?"}`,
        ].join(" | ");
      })
      .join("\n");

    const personalityCtx = brand ? [
      brand.hook_style && `Hook style: ${brand.hook_style}`,
      brand.emotional_arc_preference && `Emotional arc: ${brand.emotional_arc_preference}`,
      brand.pattern_interrupt_style && `Pattern interrupts: ${brand.pattern_interrupt_style}`,
      brand.pacing_style && `Pacing: ${brand.pacing_style}`,
      brand.creator_archetype && `Creator archetype: ${brand.creator_archetype}`,
      brand.tone_summary && `Tone: ${brand.tone_summary}`,
    ].filter(Boolean).join("\n") : "Default: high energy, fast cuts, authentic and direct.";

    const learnedInsights = insights
      .map(i => {
        const d = i.insight_data as Record<string, unknown>;
        return d.insight || d.meaning || "";
      })
      .filter(Boolean)
      .join("; ");

    // === 3. AI Creative Director — build emotional timeline ===
    const directorPrompt = `You are a world-class video editor and creative director for ${user?.name || "a creator"} on ${platform || "TikTok/Instagram"}.

Your job: create a ${targetDuration}-second video that feels CRAFTED, not assembled. Every cut should be intentional.

=== CREATOR'S LEARNED PERSONALITY ===
${personalityCtx}

=== WHAT YOU KNOW ABOUT WHAT WORKS FOR THEM ===
${learnedInsights || "Build from the vibe and content type."}

=== THIS VIDEO ===
Title: "${title}"
Vibe: "${vibe || "engaging and authentic"}"
Platform: ${platform || "TikTok/Instagram Reels"}
Target duration: ${targetDuration} seconds
Script/narration: "${script.slice(0, 500)}"

=== AVAILABLE CLIPS ===
${clipDescriptions}

=== CREATIVE FRAMEWORK ===
Use the emotional arc framework:
1. HOOK (0-3s): The most visually arresting moment. No slow starts. Pattern interrupt from scroll.
2. BUILD (3-40%): Establish the story, problem, or context. Match narrator energy.
3. PEAK (40-70%): The payoff, revelation, or most emotional beat.
4. RESOLUTION/CTA (70-100%): Land the message. Leave them wanting more or moved.

=== EDITING RULES ===
- First clip MUST be the highest-energy or most visually surprising clip (it's the hook)
- Cut BEFORE the viewer gets bored (avg clip 2-4s for high-energy, 4-6s for emotional)  
- Pattern interrupts: switch clip type (close-up → wide, indoor → outdoor) every 5-8 seconds
- Match clip energy to script section being narrated
- Total clip durations must sum to EXACTLY ${targetDuration} seconds
- For images: set trimStart=0 and trimEnd to your desired hold duration
- For videos: trimStart and trimEnd select which portion to use (stay within video duration)
- You CAN reuse clips at different trim points for rhythm and emphasis

Return ONLY this JSON:
{
  "editorialNote": "one sentence on your creative strategy for this video",
  "emotionalArc": "brief description of the emotional journey",
  "hookAnalysis": "why the first clip is the strongest hook",
  "clips": [
    {
      "uploadId": "exact-id",
      "trimStart": 0,
      "trimEnd": 3,
      "purpose": "hook",
      "emotionTag": "surprise",
      "transitionStyle": "cut"
    }
  ],
  "totalDuration": ${targetDuration},
  "pacingNote": "describe the rhythm of cuts"
}`;

    const directorRes = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1500,
      temperature: 0.65,
      messages: [{ role: "user", content: directorPrompt }],
      response_format: { type: "json_object" },
    });

    interface TimelineJSON {
      clips: TimelineClip[];
      totalDuration: number;
      editorialNote: string;
      emotionalArc: string;
      hookAnalysis: string;
      pacingNote: string;
    }

    let timeline: TimelineJSON;
    try {
      timeline = JSON.parse(directorRes.choices[0]?.message?.content || "{}") as TimelineJSON;
      if (!timeline.clips?.length) throw new Error("No clips");
    } catch {
      // Fallback: distribute evenly
      const perClip = targetDuration / uploads.length;
      timeline = {
        editorialNote: "Even distribution fallback",
        emotionalArc: "start → middle → end",
        hookAnalysis: "First clip used as hook",
        pacingNote: "Even pacing",
        clips: uploads.map((u, i) => ({
          uploadId: u.id,
          trimStart: 0,
          trimEnd: u.file_type === "image" ? perClip : Math.min(perClip, u.video_duration_sec || perClip),
          purpose: i === 0 ? "hook" : i === uploads.length - 1 ? "outro" : "build",
          emotionTag: "engaged",
          transitionStyle: "cut",
        })),
        totalDuration: targetDuration,
      };
    }

    // Save timeline to project
    if (projectId) {
      await query(
        "UPDATE projects SET timeline = $1 WHERE id = $2 AND user_id = $3",
        [JSON.stringify(timeline), projectId, userId]
      );
    }

    // === 4. Render individual clip segments ===
    const uploadMap = new Map(uploads.map(u => [u.id, u]));
    const clipPaths: string[] = [];

    for (let i = 0; i < timeline.clips.length; i++) {
      const tc = timeline.clips[i];
      const upload = uploadMap.get(tc.uploadId);
      if (!upload) continue;

      const clipPath = join(tmpDir, `${jobId}_c${i}.mp4`);
      tempFiles.push(clipPath);

      const ok = await renderClip(upload, tc.trimStart, tc.trimEnd, clipPath);
      if (ok) clipPaths.push(clipPath);
    }

    if (!clipPaths.length) {
      return NextResponse.json({
        error: "No clips could be rendered. Verify your files are valid videos or images.",
      }, { status: 422 });
    }

    // === 5. Concatenate all clips ===
    const concatPath = join(tmpDir, `${jobId}_concat.mp4`);
    const listPath = join(tmpDir, `${jobId}_list.txt`);
    tempFiles.push(concatPath, listPath);

    await writeFile(listPath, clipPaths.map(p => `file '${p}'`).join("\n"));
    await execAsync(
      `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p "${concatPath}"`,
      { timeout: 90000 }
    );

    // === 6. Generate voice narration if needed ===
    let narrationBase64 = audioBase64 || null;
    const voiceId = user?.elevenlabs_voice_id;

    if (!narrationBase64 && voiceId && script && useVoiceClone !== false) {
      try {
        const connectors = new ReplitConnectors();
        const ttsRes = await connectors.proxy("elevenlabs", `/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({
            text: script,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.48, similarity_boost: 0.87, style: 0.45, use_speaker_boost: true },
          }),
        });
        if (ttsRes.ok) {
          const buf = await ttsRes.arrayBuffer();
          narrationBase64 = Buffer.from(buf).toString("base64");
        }
      } catch (e) {
        console.error("TTS error:", e);
      }
    }

    // === 7. Music selection + mixing ===
    let musicPath: string | null = null;
    let musicConfig: MusicConfig | null = null;

    if (includeMusic !== false) {
      try {
        const musicRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5000"}/api/music/select`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: req.headers.get("cookie") || "" },
            body: JSON.stringify({ vibe, platform, duration: targetDuration, title }),
          }
        );
        if (musicRes.ok) {
          const musicData = await musicRes.json() as {
            track?: { url: string };
            musicVolumeUnderVoice?: number;
            musicVolumeNoVoice?: number;
            introFadeInSec?: number;
            outroFadeOutSec?: number;
          };
          if (musicData.track?.url) {
            const mPath = join(tmpDir, `${jobId}_music.mp3`);
            tempFiles.push(mPath);
            const downloaded = await downloadMusicTrack(musicData.track.url, mPath);
            if (downloaded) {
              musicPath = mPath;
              musicConfig = {
                url: musicData.track.url,
                volumeUnderVoice: musicData.musicVolumeUnderVoice || 0.12,
                volumeNoVoice: musicData.musicVolumeNoVoice || 0.35,
                fadeInSec: musicData.introFadeInSec || 1.5,
                fadeOutSec: musicData.outroFadeOutSec || 2.0,
              };
            }
          }
        }
      } catch (e) {
        console.error("Music selection error:", e);
      }
    }

    // === 8. Final audio mix: voice + music with smart ducking ===
    const outputPath = join(tmpDir, `${jobId}_final.mp4`);
    tempFiles.push(outputPath);

    if (narrationBase64 && musicPath && musicConfig) {
      // Full mix: voice narration + background music with ducking
      const narPath = join(tmpDir, `${jobId}_narration.mp3`);
      tempFiles.push(narPath);
      await writeFile(narPath, Buffer.from(narrationBase64, "base64"));

      const mc = musicConfig;
      // Music: loop to fill duration, fade in/out, duck under voice
      // Voice: normalize, ensure it's prominent
      await execAsync(
        `ffmpeg -y ` +
        `-i "${concatPath}" ` +           // [0] video
        `-i "${narPath}" ` +              // [1] narration
        `-stream_loop -1 -i "${musicPath}" ` + // [2] music (looped)
        `-filter_complex "` +
          `[1:a]aresample=44100,volume=1.1[nar];` +
          `[2:a]atrim=0:${targetDuration + 2},aresample=44100,afade=t=in:ss=0:d=${mc.fadeInSec},afade=t=out:st=${Math.max(0, targetDuration - mc.fadeOutSec)}:d=${mc.fadeOutSec},volume=${mc.volumeUnderVoice}[bgm];` +
          `[nar][bgm]amix=inputs=2:duration=first:dropout_transition=2[amix]` +
        `" ` +
        `-map 0:v -map "[amix]" ` +
        `-c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p ` +
        `-c:a aac -b:a 192k -shortest "${outputPath}"`,
        { timeout: 90000 }
      );
    } else if (narrationBase64) {
      // Voice only (no music downloaded or includeMusic=false)
      const narPath = join(tmpDir, `${jobId}_narration.mp3`);
      tempFiles.push(narPath);
      await writeFile(narPath, Buffer.from(narrationBase64, "base64"));

      await execAsync(
        `ffmpeg -y -i "${concatPath}" -i "${narPath}" ` +
        `-filter_complex "[1:a]aresample=44100,volume=1.1[nar]" ` +
        `-map 0:v -map "[nar]" ` +
        `-c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p ` +
        `-c:a aac -b:a 192k -shortest "${outputPath}"`,
        { timeout: 90000 }
      );
    } else if (musicPath && musicConfig) {
      // Music only (no voice narration)
      const mc = musicConfig;
      await execAsync(
        `ffmpeg -y -i "${concatPath}" -stream_loop -1 -i "${musicPath}" ` +
        `-filter_complex "[1:a]atrim=0:${targetDuration + 2},aresample=44100,afade=t=in:ss=0:d=${mc.fadeInSec},afade=t=out:st=${Math.max(0, targetDuration - mc.fadeOutSec)}:d=${mc.fadeOutSec},volume=${mc.volumeNoVoice}[bgm]" ` +
        `-map 0:v -map "[bgm]" ` +
        `-c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p ` +
        `-c:a aac -b:a 192k -shortest "${outputPath}"`,
        { timeout: 90000 }
      );
    } else {
      // Silent video
      await execAsync(
        `ffmpeg -y -i "${concatPath}" -f lavfi -i anullsrc=r=44100:cl=stereo ` +
        `-c:v copy -c:a aac -b:a 64k -shortest "${outputPath}"`,
        { timeout: 30000 }
      );
    }

    // === 9. Save final video ===
    const userDir = join(process.cwd(), "public", "media", userId);
    await mkdir(userDir, { recursive: true });

    const renderName = `${projectId || jobId}_render_${Date.now()}.mp4`;
    const renderRelPath = `/media/${userId}/${renderName}`;
    const renderPublicPath = join(userDir, renderName);

    await writeFile(renderPublicPath, await readFile(outputPath));

    if (projectId) {
      await query(
        "UPDATE projects SET render_path = $1, status = 'completed' WHERE id = $2 AND user_id = $3",
        [renderRelPath, projectId, userId]
      );
    }

    // Log voice narration creation
    if (narrationBase64 && !audioBase64 && projectId && voiceId) {
      await query(
        `INSERT INTO voiceovers (user_id, project_id, script_content, provider, provider_voice_id, status)
         VALUES ($1, $2, $3, 'elevenlabs', $4, 'completed') ON CONFLICT DO NOTHING`,
        [userId, projectId, script, voiceId]
      ).catch(() => null);
    }

    // Update brand profile generation count
    await query(
      `UPDATE brand_profiles SET generation_count = generation_count + 1, updated_at = now()
       WHERE user_id = $1`,
      [userId]
    ).catch(() => null);

    // Trigger brand learning if generation count is a milestone
    const genRows = await query(
      "SELECT generation_count FROM brand_profiles WHERE user_id = $1",
      [userId]
    ).catch(() => ({ rows: [] as { generation_count: number }[] }));
    const genCount = (genRows.rows[0] as { generation_count: number } | undefined)?.generation_count || 0;

    if (genCount % 3 === 0) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5000"}/api/brand/learn`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: req.headers.get("cookie") || "" },
        body: JSON.stringify({ trigger: "generation_milestone" }),
      }).catch(() => null);
    }

    return NextResponse.json({
      videoUrl: renderRelPath,
      timeline,
      narrationGenerated: !!narrationBase64,
      musicIncluded: !!musicPath,
      clipCount: clipPaths.length,
      editorialNote: timeline.editorialNote,
      emotionalArc: timeline.emotionalArc,
    });
  } catch (err) {
    console.error("Compose error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 400) : "Compose failed" },
      { status: 500 }
    );
  } finally {
    for (const f of tempFiles) {
      unlink(f).catch(() => null);
    }
  }
}

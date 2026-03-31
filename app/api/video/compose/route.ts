import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { writeFile, unlink, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { exec } from "child_process";
import { promisify } from "util";
import Anthropic from "@anthropic-ai/sdk";
import { ReplitConnectors } from "@replit/connectors-sdk";

export const maxDuration = 120;
const execAsync = promisify(exec);

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const VIDEO_W = 1080;
const VIDEO_H = 1920;
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
// Scale to fill 9:16 frame, slight zoom-in punch (1.06x scale then crop)
const SCALE_FILL = `scale=${Math.round(VIDEO_W * 1.06)}:${Math.round(VIDEO_H * 1.06)}:force_original_aspect_ratio=increase,crop=${VIDEO_W}:${VIDEO_H},fps=30`;

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
  purpose: string;
  emotionTag: string;
  transitionStyle: string;
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

// ─── Title Card ────────────────────────────────────────────────────────────────
async function renderTitleCard(
  title: string,
  subtitle: string,
  outPath: string,
  durationSec = 2.8
): Promise<boolean> {
  // Escape special FFmpeg drawtext characters
  const esc = (s: string) =>
    s.replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/,/g, "\\,").replace(/\[/g, "\\[").replace(/\]/g, "\\]");

  const safeTitle = esc(title.slice(0, 50));
  const safeSub = esc(subtitle.slice(0, 60));

  // Split long titles into two lines at word boundary
  const words = safeTitle.split(" ");
  let line1 = safeTitle;
  let line2 = "";
  if (safeTitle.length > 22 && words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    line1 = words.slice(0, mid).join(" ");
    line2 = words.slice(mid).join(" ");
  }

  const fadeIn = 0.5;
  const fadeOut = 0.45;
  const fadeOutStart = durationSec - fadeOut;

  const textFilters = [
    // Faint lemon-yellow top stripe
    `drawbox=x=0:y=0:w=${VIDEO_W}:h=8:color=0xF8F8A6@0.9:t=fill`,
    // Big title line 1
    `drawtext=fontfile='${FONT}':text='${line1}':fontsize=88:fontcolor=white:x=(w-text_w)/2:y=${line2 ? "(h-text_h)/2-60" : "(h-text_h)/2"}:alpha='if(lt(t,${fadeIn}),t/${fadeIn},if(gt(t,${fadeOutStart}),max(0,(${durationSec}-t)/${fadeOut}),1))'`,
  ];
  if (line2) {
    textFilters.push(
      `drawtext=fontfile='${FONT}':text='${line2}':fontsize=88:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+50:alpha='if(lt(t,${fadeIn}),t/${fadeIn},if(gt(t,${fadeOutStart}),max(0,(${durationSec}-t)/${fadeOut}),1))'`
    );
  }
  if (safeSub) {
    textFilters.push(
      `drawtext=fontfile='${FONT}':text='${safeSub}':fontsize=42:fontcolor=0xF8F8A6:x=(w-text_w)/2:y=h*0.62:alpha='if(lt(t,${fadeIn + 0.2}),(t-0.2)/${fadeIn},if(gt(t,${fadeOutStart}),max(0,(${durationSec}-t)/${fadeOut}),1))'`
    );
  }

  // Fade video itself in/out from black
  const videoFade = `fade=t=in:st=0:d=${fadeIn},fade=t=out:st=${fadeOutStart}:d=${fadeOut}`;
  const vf = [videoFade, ...textFilters].join(",");

  try {
    await execAsync(
      `ffmpeg -y -f lavfi -i "color=c=black:s=${VIDEO_W}x${VIDEO_H}:r=30" -t ${durationSec} ` +
      `-vf "${vf}" ` +
      `-c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -an "${outPath}"`,
      { timeout: 30000 }
    );
    return true;
  } catch (err) {
    console.error("Title card render failed:", err);
    return false;
  }
}

// ─── Clip Renderer ────────────────────────────────────────────────────────────
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
      // Ken Burns slow zoom for images — life and movement in stills
      const frames = Math.round(dur * 30);
      await execAsync(
        `ffmpeg -y -loop 1 -i "${absPath}" -t ${dur} ` +
        `-vf "${SCALE_FILL},zoompan=z='min(zoom+0.0005,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${VIDEO_W}x${VIDEO_H},fps=30" ` +
        `-an -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p "${outPath}"`,
        { timeout: 60000 }
      );
    } else {
      // Video — trim + punched-in zoom feel via slight upscale+crop
      const realDur = await getVideoDuration(absPath);
      const safeStart = Math.min(trimStart, Math.max(0, realDur - 0.5));
      const safeDur = Math.min(Math.max(0.5, dur), realDur - safeStart);
      await execAsync(
        `ffmpeg -y -ss ${safeStart.toFixed(2)} -i "${absPath}" -t ${safeDur.toFixed(2)} ` +
        `-vf "${SCALE_FILL}" ` +
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

// ─── xFade chain ─────────────────────────────────────────────────────────────
// Chains N clips together with smooth crossfade transitions using FFmpeg xfade
async function chainWithXfade(
  clips: { path: string; duration: number; transition: string }[],
  outPath: string
): Promise<void> {
  if (clips.length === 0) throw new Error("No clips to chain");

  if (clips.length === 1) {
    // Single clip — just copy it
    await execAsync(`ffmpeg -y -i "${clips[0].path}" -c:v copy -an "${outPath}"`, { timeout: 30000 });
    return;
  }

  const XFADE_DUR = 0.35; // crossfade overlap duration in seconds

  // Map transition style to FFmpeg xfade transition name
  const xfadeType = (style: string) => {
    if (style === "fade") return "fade";
    if (style === "jump") return "fade"; // fast fade for jump cuts
    return "fade"; // default
  };

  // Build inputs and filter_complex
  const inputs = clips.map(c => `-i "${c.path}"`).join(" ");

  // Build the xfade filter chain
  let filterParts: string[] = [];
  let currentLabel = "[0:v]";
  let cumulativeDur = 0;

  for (let i = 1; i < clips.length; i++) {
    const prevDur = clips[i - 1].duration;
    const xtype = xfadeType(clips[i].transition || "fade");
    const offset = Math.max(0, cumulativeDur + prevDur - XFADE_DUR);
    const nextLabel = i === clips.length - 1 ? "[vout]" : `[v${i}]`;
    filterParts.push(`${currentLabel}[${i}:v]xfade=transition=${xtype}:duration=${XFADE_DUR}:offset=${offset.toFixed(3)}${nextLabel}`);
    currentLabel = nextLabel;
    cumulativeDur += prevDur - XFADE_DUR;
  }

  const filterComplex = filterParts.join(";");

  await execAsync(
    `ffmpeg -y ${inputs} ` +
    `-filter_complex "${filterComplex}" ` +
    `-map [vout] ` +
    `-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -an "${outPath}"`,
    { timeout: 120000 }
  );
}

async function downloadMusicTrack(url: string, destPath: string): Promise<boolean> {
  try {
    await execAsync(`curl -sL --max-time 20 -o "${destPath}" "${url}"`, { timeout: 25000 });
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
  const targetDuration = typeof duration === "number" ? duration : (parseInt(String(duration), 10) || 30);
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

    const uploads = uploadRows.rows as unknown as UploadRow[];
    const brand = brandRows.rows[0] as unknown as BrandProfile | undefined;
    const user = userRows.rows[0] as unknown as { name: string; elevenlabs_voice_id?: string };
    const insights = insightRows.rows as unknown as { insight_data: Record<string, unknown> }[];

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

Your job: create a ${targetDuration}-second video body (EXCLUDING a 2.8s intro title card that is added automatically).

=== CREATOR'S LEARNED PERSONALITY ===
${personalityCtx}

=== WHAT YOU KNOW ABOUT WHAT WORKS FOR THEM ===
${learnedInsights || "Build from the vibe and content type."}

=== THIS VIDEO ===
Title: "${title}"
Vibe: "${vibe || "engaging and authentic"}"
Platform: ${platform || "TikTok/Instagram Reels"}
Target body duration: ${targetDuration} seconds
Script/narration: "${script.slice(0, 500)}"

=== AVAILABLE CLIPS ===
${clipDescriptions}

=== CREATIVE FRAMEWORK ===
Emotional arc:
1. HOOK (0-3s): Most visually arresting moment. No slow starts.
2. BUILD (3-40%): Establish story or context. Match narrator energy.
3. PEAK (40-70%): Payoff, revelation, or most emotional beat.
4. RESOLUTION/CTA (70-100%): Land the message.

=== EDITING RULES ===
- First clip MUST be the highest-energy or most visually surprising clip (it's the hook)
- Cut BEFORE viewer gets bored (avg clip 2-4s for high-energy, 4-6s for emotional)
- Pattern interrupts: switch clip type every 5-8 seconds
- transitionStyle: use "fade" for smooth cinematic feel, "cut" for energy, "jump" for rhythm — be intentional
- Total clip durations must sum to EXACTLY ${targetDuration} seconds
- For images: trimStart=0, trimEnd = your desired hold duration
- For videos: trimStart and trimEnd select which portion to use (stay within video duration)
- You CAN reuse clips at different trim points for rhythm

Return ONLY this JSON:
{
  "editorialNote": "one sentence creative strategy",
  "emotionalArc": "brief emotional journey description",
  "hookAnalysis": "why the first clip is the strongest hook",
  "clips": [
    {
      "uploadId": "exact-id",
      "trimStart": 0,
      "trimEnd": 3,
      "purpose": "hook",
      "emotionTag": "surprise",
      "transitionStyle": "fade"
    }
  ],
  "totalDuration": ${targetDuration},
  "pacingNote": "describe the rhythm"
}`;

    const directorRes = await ai.messages.create({
      model: "claude-sonnet-4-5",
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
      timeline = JSON.parse(directorRes.content[0]?.type === "text" ? completion.content[0].text : "" || "{}") as TimelineJSON;
      if (!timeline.clips?.length) throw new Error("No clips");
    } catch {
      const perClip = targetDuration / uploads.length;
      timeline = {
        editorialNote: "Even distribution fallback",
        emotionalArc: "start → middle → end",
        hookAnalysis: "First clip used as hook",
        pacingNote: "Even pacing",
        clips: uploads.map((u, i) => ({
          uploadId: u.id,
          trimStart: 0,
          trimEnd: u.file_type === "image" ? perClip : Math.min(perClip, parseFloat(String(u.video_duration_sec)) || perClip),
          purpose: i === 0 ? "hook" : i === uploads.length - 1 ? "outro" : "build",
          emotionTag: "engaged",
          transitionStyle: "fade",
        })),
        totalDuration: targetDuration,
      };
    }

    if (projectId) {
      await query(
        "UPDATE projects SET timeline = $1 WHERE id = $2 AND user_id = $3",
        [JSON.stringify(timeline), projectId, userId]
      );
    }

    // === 4. Render title card ===
    const titleCardPath = join(tmpDir, `${jobId}_title.mp4`);
    const TITLE_DUR = 2.8;
    tempFiles.push(titleCardPath);
    const titleOk = await renderTitleCard(
      title,
      vibe || platform || "",
      titleCardPath,
      TITLE_DUR
    );

    // === 5. Render individual clip segments ===
    const uploadMap = new Map(uploads.map(u => [u.id, u]));
    type RenderedClip = { path: string; duration: number; transition: string };
    const renderedClips: RenderedClip[] = [];

    for (let i = 0; i < timeline.clips.length; i++) {
      const tc = timeline.clips[i];
      const upload = uploadMap.get(tc.uploadId);
      if (!upload) continue;

      const clipPath = join(tmpDir, `${jobId}_c${i}.mp4`);
      tempFiles.push(clipPath);

      const ok = await renderClip(upload, tc.trimStart, tc.trimEnd, clipPath);
      if (ok) {
        renderedClips.push({
          path: clipPath,
          duration: Math.max(0.5, tc.trimEnd - tc.trimStart),
          transition: tc.transitionStyle || "fade",
        });
      }
    }

    if (!renderedClips.length) {
      return NextResponse.json({
        error: "No clips could be rendered. Verify your files are valid videos or images.",
      }, { status: 422 });
    }

    // === 6. Chain clips with xfade transitions ===
    const chainedBodyPath = join(tmpDir, `${jobId}_body.mp4`);
    tempFiles.push(chainedBodyPath);
    await chainWithXfade(renderedClips, chainedBodyPath);

    // === 7. Prepend title card ===
    const concatPath = join(tmpDir, `${jobId}_concat.mp4`);
    tempFiles.push(concatPath);

    if (titleOk) {
      // Crossfade title card into first clip (0.4s fade)
      const TITLE_XFADE = 0.4;
      const titleOffset = Math.max(0, TITLE_DUR - TITLE_XFADE);
      await execAsync(
        `ffmpeg -y -i "${titleCardPath}" -i "${chainedBodyPath}" ` +
        `-filter_complex "[0:v][1:v]xfade=transition=fade:duration=${TITLE_XFADE}:offset=${titleOffset.toFixed(3)}[vout]" ` +
        `-map [vout] -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -an "${concatPath}"`,
        { timeout: 60000 }
      );
    } else {
      // Title card failed — use body only
      await execAsync(`ffmpeg -y -i "${chainedBodyPath}" -c:v copy -an "${concatPath}"`, { timeout: 30000 });
    }

    // === 8. Voice narration ===
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

    // === 9. Music selection ===
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
                volumeNoVoice: musicData.musicVolumeNoVoice || 0.38,
                fadeInSec: musicData.introFadeInSec || 1.2,
                fadeOutSec: musicData.outroFadeOutSec || 2.0,
              };
            }
          }
        }
      } catch (e) {
        console.error("Music selection error:", e);
      }
    }

    // Total video duration including title card
    const totalVideoDur = TITLE_DUR + targetDuration;

    // === 10. Final audio mix: voice + music ===
    const outputPath = join(tmpDir, `${jobId}_final.mp4`);
    tempFiles.push(outputPath);

    if (narrationBase64 && musicPath && musicConfig) {
      const narPath = join(tmpDir, `${jobId}_narration.mp3`);
      tempFiles.push(narPath);
      await writeFile(narPath, Buffer.from(narrationBase64, "base64"));

      const mc = musicConfig;
      const totalDur = totalVideoDur;
      await execAsync(
        `ffmpeg -y ` +
        `-i "${concatPath}" ` +
        `-i "${narPath}" ` +
        `-stream_loop -1 -i "${musicPath}" ` +
        `-filter_complex "` +
          `[1:a]adelay=${Math.round(TITLE_DUR * 1000)}|${Math.round(TITLE_DUR * 1000)},aresample=44100,volume=1.1[nar];` +
          `[2:a]atrim=0:${totalDur + 2},aresample=44100,afade=t=in:ss=0:d=${mc.fadeInSec},afade=t=out:st=${Math.max(0, totalDur - mc.fadeOutSec)}:d=${mc.fadeOutSec},volume=${mc.volumeUnderVoice}[bgm];` +
          `[nar][bgm]amix=inputs=2:duration=longest:dropout_transition=2[amix]` +
        `" ` +
        `-map 0:v -map "[amix]" ` +
        `-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p ` +
        `-c:a aac -b:a 192k -shortest "${outputPath}"`,
        { timeout: 90000 }
      );
    } else if (narrationBase64) {
      const narPath = join(tmpDir, `${jobId}_narration.mp3`);
      tempFiles.push(narPath);
      await writeFile(narPath, Buffer.from(narrationBase64, "base64"));

      await execAsync(
        `ffmpeg -y -i "${concatPath}" -i "${narPath}" ` +
        `-filter_complex "[1:a]adelay=${Math.round(TITLE_DUR * 1000)}|${Math.round(TITLE_DUR * 1000)},aresample=44100,volume=1.1[nar]" ` +
        `-map 0:v -map "[nar]" ` +
        `-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p ` +
        `-c:a aac -b:a 192k -shortest "${outputPath}"`,
        { timeout: 90000 }
      );
    } else if (musicPath && musicConfig) {
      const mc = musicConfig;
      const totalDur = totalVideoDur;
      await execAsync(
        `ffmpeg -y -i "${concatPath}" -stream_loop -1 -i "${musicPath}" ` +
        `-filter_complex "[1:a]atrim=0:${totalDur + 2},aresample=44100,afade=t=in:ss=0:d=${mc.fadeInSec},afade=t=out:st=${Math.max(0, totalDur - mc.fadeOutSec)}:d=${mc.fadeOutSec},volume=${mc.volumeNoVoice}[bgm]" ` +
        `-map 0:v -map "[bgm]" ` +
        `-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p ` +
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

    // === 11. Save final video ===
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

    if (narrationBase64 && !audioBase64 && projectId && voiceId) {
      await query(
        `INSERT INTO voiceovers (user_id, project_id, script_content, provider, provider_voice_id, status)
         VALUES ($1, $2, $3, 'elevenlabs', $4, 'completed') ON CONFLICT DO NOTHING`,
        [userId, projectId, script, voiceId]
      ).catch(() => null);
    }

    await query(
      `UPDATE brand_profiles SET generation_count = generation_count + 1, updated_at = now() WHERE user_id = $1`,
      [userId]
    ).catch(() => null);

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
      clipCount: renderedClips.length,
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




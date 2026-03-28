import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { exec } from "child_process";
import { promisify } from "util";

export const maxDuration = 120;

const execAsync = promisify(exec);
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const VIDEO_W = 1080;
const VIDEO_H = 1920;
const FPS = 30;

function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\u2019")
    .replace(/"/g, "\u201d")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/%/g, "\\%")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\n/g, " ")
    .trim();
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word.slice(0, maxChars);
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`
    );
    return Math.max(5, parseFloat(stdout.trim()) || 30);
  } catch {
    return 30;
  }
}

function dtLine(
  text: string,
  y: number,
  fontSize: number,
  color: string,
  tStart: number,
  tEnd: number
): string {
  const escaped = esc(text);
  if (!escaped) return "";
  return (
    `drawtext=text='${escaped}':` +
    `fontfile='${FONT}':` +
    `fontsize=${fontSize}:` +
    `fontcolor=${color}:` +
    `x=(w-text_w)/2:` +
    `y=${y}:` +
    `enable='between(t\\,${tStart.toFixed(2)}\\,${tEnd.toFixed(2)})'`
  );
}

function dbLine(x: number, y: number, w: number, h: number, color: string, tStart: number, tEnd: number): string {
  return `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}:t=fill:enable='between(t\\,${tStart.toFixed(2)}\\,${tEnd.toFixed(2)})'`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { audioBase64, script, title } = await req.json() as {
    audioBase64?: string;
    script: string;
    title?: string;
  };

  if (!script?.trim()) {
    return NextResponse.json({ error: "Script required" }, { status: 400 });
  }

  const tmpDir = tmpdir();
  const id = `lumevo_${session.id.slice(0, 8)}_${Date.now()}`;
  const audioPath = join(tmpDir, `${id}.mp3`);
  const outputPath = join(tmpDir, `${id}_out.mp4`);

  try {
    let hasAudio = false;
    if (audioBase64) {
      await writeFile(audioPath, Buffer.from(audioBase64, "base64"));
      hasAudio = true;
    }

    const audioDuration = hasAudio ? await getAudioDuration(audioPath) : 30;

    const rawSections = script.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const sections = rawSections.slice(0, 6);
    const sectionDuration = audioDuration / sections.length;

    const dtFilters: string[] = [];

    // Lumevo wordmark at top
    const wm = `drawtext=text='LUMEVO STUDIO':fontfile='${FONT}':fontsize=30:fontcolor=0xFF2D2D@0.6:x=(w-text_w)/2:y=80`;
    dtFilters.push(wm);

    // Top accent bar
    dtFilters.push(dbLine(0, 0, VIDEO_W, 4, "0xFF2D2D@0.8", 0, audioDuration));

    // Bottom accent bar
    dtFilters.push(dbLine(0, VIDEO_H - 4, VIDEO_W, 4, "0xFF2D2D@0.3", 0, audioDuration));

    // Script sections
    sections.forEach((section, si) => {
      const tStart = si * sectionDuration;
      const tEnd = (si + 1) * sectionDuration - 0.25;
      const isHook = si === 0;
      const fontSize = isHook ? 78 : 62;
      const color = isHook ? "0xFFFFFF" : "0xD8D8D8";
      const maxChars = isHook ? 18 : 24;
      const lineHeight = isHook ? 96 : 78;

      const lines = wrapLines(section, maxChars);
      const totalTextH = lines.length * lineHeight;
      const startY = Math.floor((VIDEO_H - totalTextH) / 2) - 60;

      lines.forEach((line, li) => {
        const y = startY + li * lineHeight;
        const dt = dtLine(line, y, fontSize, color, tStart, tEnd);
        if (dt) dtFilters.push(dt);
      });

      // Red underline for hook
      if (isHook) {
        const underlineY = startY + lines.length * lineHeight + 24;
        dtFilters.push(dbLine((VIDEO_W - 160) / 2, underlineY, 160, 4, "0xFF2D2D@0.9", tStart, tEnd));
      }

      // Section counter (not for hook)
      if (!isHook) {
        const counterDt = `drawtext=text='${si + 1} / ${sections.length}':fontfile='${FONT}':fontsize=22:fontcolor=0xFFFFFF@0.2:x=(w-text_w)/2:y=${VIDEO_H - 90}:enable='between(t\\,${tStart.toFixed(2)}\\,${tEnd.toFixed(2)})'`;
        dtFilters.push(counterDt);
      }
    });

    // Title card overlay (shows at very end for 2 seconds, or if title provided)
    if (title && audioDuration > 4) {
      const tStart = audioDuration - 2.5;
      const titleLines = wrapLines(title.toUpperCase(), 18);
      const lh = 70;
      const totalH = titleLines.length * lh;
      const startY = Math.floor((VIDEO_H - totalH) / 2);
      titleLines.forEach((line, i) => {
        const dt = dtLine(line, startY + i * lh, 54, "0xFF2D2D", tStart, audioDuration);
        if (dt) dtFilters.push(dt);
      });
    }

    const filterStr = `[0:v]${dtFilters.join(",\n")}[vout]`;

    const bgColor = "0x0d0d0d";
    let ffmpegCmd: string;

    if (hasAudio) {
      ffmpegCmd = [
        "ffmpeg -y",
        `-f lavfi -i "color=c=${bgColor}:size=${VIDEO_W}x${VIDEO_H}:rate=${FPS}:duration=${(audioDuration + 1).toFixed(2)}"`,
        `-i "${audioPath}"`,
        `-filter_complex "${filterStr}"`,
        `-map "[vout]" -map 1:a`,
        `-c:v libx264 -preset fast -crf 26 -pix_fmt yuv420p`,
        `-c:a aac -b:a 128k`,
        `-shortest`,
        `"${outputPath}"`,
      ].join(" ");
    } else {
      ffmpegCmd = [
        "ffmpeg -y",
        `-f lavfi -i "color=c=${bgColor}:size=${VIDEO_W}x${VIDEO_H}:rate=${FPS}:duration=30"`,
        `-filter_complex "${filterStr}"`,
        `-map "[vout]"`,
        `-c:v libx264 -preset fast -crf 26 -pix_fmt yuv420p -t 30`,
        `"${outputPath}"`,
      ].join(" ");
    }

    await execAsync(ffmpegCmd, { timeout: 110000 });

    const videoBuffer = await readFile(outputPath);
    return NextResponse.json({ videoBase64: videoBuffer.toString("base64"), mimeType: "video/mp4" });

  } catch (err) {
    console.error("Video render error:", err);
    const msg = err instanceof Error ? err.message.slice(0, 300) : "Render failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    unlink(audioPath).catch(() => null);
    unlink(outputPath).catch(() => null);
  }
}

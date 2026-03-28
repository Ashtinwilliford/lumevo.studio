import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface ProjectState {
  title: string | null;
  platforms: string[] | null;
  vibe: string | null;
  duration: number | null;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messages, projectState, userName } = await req.json() as {
    messages: { role: string; content: string }[];
    projectState: ProjectState;
    userName: string;
  };

  const brandRows = await query("SELECT * FROM brand_profiles WHERE user_id = $1", [session.id]);
  const brand = brandRows.rows[0];
  const brandContext = brand?.tone_summary
    ? `Their brand voice: ${brand.tone_summary}.`
    : brand?.voice_style
    ? `Their content style: ${brand.voice_style}, niche: ${brand.niche || "lifestyle"}.`
    : "";

  // Figure out where we are in the flow
  const hasTitle = !!projectState.title;
  const hasPlatform = !!(projectState.platforms?.length);
  const hasVibe = !!projectState.vibe;
  const hasDuration = !!projectState.duration;
  const allCollected = hasTitle && hasPlatform && hasVibe && hasDuration;

  const knownSoFar = [
    projectState.title ? `Topic: "${projectState.title}"` : null,
    projectState.platforms?.length ? `Platform: ${projectState.platforms.join(" + ")}` : null,
    projectState.vibe ? `Vibe: "${projectState.vibe}"` : null,
    projectState.duration ? `Duration: ${projectState.duration}s` : null,
  ].filter(Boolean).join(" | ");

  const systemPrompt = `You are Lumevo — a creative AI director having a fast, warm, punchy conversation with ${userName} to plan their next piece of content.

${brandContext}

STRICT STEP ORDER — only ask ONE thing per message:
- Step 1 (if no title yet): Find out what the content is about. Be curious and specific.
- Step 2 (if no platform yet): Ask which platform — Instagram, TikTok, or both.
- Step 3 (if no vibe yet): Ask for the mood/vibe/direction. Give 1-2 short examples to spark ideas.
- Step 4 (if no duration yet): Ask how long — 15, 30, or 60 seconds.
- Step 5 (ALL 4 collected): Say something like "Perfect, I have everything I need. Now I just need your media — drop in your clips, photos, or audio and I'll handle the rest." Then set needsUpload: true.

Rules:
- Keep messages SHORT — 1-3 sentences MAX. No lists. No essays.
- Be warm and snappy — like a creative director who's excited about their work
- Use ${userName}'s name occasionally
- When they give you vague answers, accept them and move forward
- Never repeat a question you already asked
- Never ask about media type (voiceover vs music) — that's handled automatically

Currently known: ${knownSoFar || "nothing yet — just getting started"}

RESPOND WITH ONLY THIS JSON (no markdown, no code fences):
{
  "message": "your short reply",
  "extracted": {
    "title": null or "string of what they're making",
    "platforms": null or ["instagram"] or ["tiktok"] or ["instagram","tiktok"],
    "vibe": null or "short mood/direction description",
    "duration": null or 15 or 30 or 60
  },
  "currentStep": "title" or "platform" or "vibe" or "duration" or "upload",
  "needsUpload": false or true
}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ],
    max_tokens: 250,
    temperature: 0.8,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: {
    message: string;
    extracted: Partial<ProjectState>;
    currentStep: string;
    needsUpload: boolean;
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      message: "Sorry, got a bit lost there — what were we saying?",
      extracted: {},
      currentStep: "title",
      needsUpload: false,
    };
  }

  // Safety: if all collected and not yet upload, force upload step
  if (allCollected && !parsed.needsUpload) {
    parsed.needsUpload = true;
    parsed.currentStep = "upload";
  }

  return NextResponse.json(parsed);
}

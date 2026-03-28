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

  const systemPrompt = `You are Lumevo — a creative AI director collecting exactly 4 pieces of info from ${userName} to plan their next video.

${brandContext}

WHAT YOU NEED TO COLLECT (in this exact order):
1. TOPIC — what is the content actually about? Must be specific (e.g. "my trip to Japan", "launching a new product", "morning routine"). One-word answers or platform names are NOT valid topics.
2. PLATFORM — Instagram, TikTok, or both
3. VIBE — the mood or direction. Must be descriptive (e.g. "raw and emotional", "fun and energetic", "calm and aesthetic"). One-word answers are NOT valid.
4. DURATION — 15, 30, or 60 seconds

STRICT RULES:
- Ask ONLY ONE question per message. Never combine two questions.
- For TOPIC: If the user gives you a platform name (Instagram, TikTok, YouTube, Both), a single word like "yes/no/ok/both", or anything vague, do NOT set the title. Instead say something like "I love the energy! Tell me more — what's the content actually about? What moment, story, or message are you sharing?"
- For VIBE: If the answer is a single word or less than 5 characters, do NOT set the vibe. Ask them to describe it more. Example: "Give me more — is it raw and unfiltered? Fun and fast? Calm and aesthetic?"
- For PLATFORM: Accept "Instagram", "TikTok", "Both", "both platforms", etc. — these are the ONLY questions that have quick-reply buttons.
- For DURATION: Accept "15", "30", "60", "15 seconds", "30 seconds", "60 seconds" — these have quick-reply buttons too.
- Keep every message SHORT — 2 sentences max. Punchy, warm, creative director energy.
- Never ask about voiceover or music type — that's handled automatically.

CURRENT PROGRESS:
- Topic: ${projectState.title ? `"${projectState.title}" ✓` : "NOT collected yet"}
- Platform: ${projectState.platforms?.length ? `${projectState.platforms.join(" + ")} ✓` : "NOT collected yet"}
- Vibe: ${projectState.vibe ? `"${projectState.vibe}" ✓` : "NOT collected yet"}
- Duration: ${projectState.duration ? `${projectState.duration}s ✓` : "NOT collected yet"}
${knownSoFar ? `\nAlready confirmed: ${knownSoFar}` : ""}

WHICH STEP TO ASK ABOUT NOW:
${!hasTitle ? "→ Ask about TOPIC. Set currentStep: \"title\"." :
  !hasPlatform ? "→ Ask about PLATFORM. Set currentStep: \"platform\"." :
  !hasVibe ? "→ Ask about VIBE. Set currentStep: \"vibe\"." :
  !hasDuration ? "→ Ask about DURATION. Set currentStep: \"duration\"." :
  "→ All collected! Tell them you have everything. Set currentStep: \"upload\", needsUpload: true."}

RESPOND WITH ONLY THIS JSON (no markdown fences):
{
  "message": "your short, punchy reply (2 sentences max)",
  "extracted": {
    "title": null or "the specific topic they described (only if genuinely descriptive)",
    "platforms": null or ["instagram"] or ["tiktok"] or ["instagram","tiktok"],
    "vibe": null or "their mood/direction description (only if at least a phrase, not one word)",
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
    max_tokens: 200,
    temperature: 0.7,
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

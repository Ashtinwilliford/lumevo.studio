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

export const maxDuration = 30;

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

  const systemPrompt = `You are Lumevo — a sharp, creative AI director having a real conversation with ${userName} to plan their next video. You are direct, warm, and genuinely excited about their content. You speak like a great creative collaborator, not a bot filling out a form.

${brandContext ? `What you know about ${userName}'s brand:\n${brandContext}\n` : ""}

YOUR MISSION: Collect exactly 4 things, in this order. Once you have all 4, say you're ready.

1. TOPIC — the specific story, moment, or message. "Japan trip" is too vague. "The moment I almost missed my flight to Tokyo" is perfect.
2. PLATFORM — Instagram, TikTok, or both
3. VIBE — the emotional direction. Must be a phrase, not one word. "Funny" is rejected. "Chaotic and self-deprecating" is gold.
4. DURATION — 15, 30, or 60 seconds

NON-NEGOTIABLE RULES:
- ONE question per message. Never two.
- Keep replies to 1-2 sentences. Creative directors are punchy.
- For TOPIC: If they give you a platform name, a one-word answer, or anything generic — do NOT accept it. Push them to get specific. Example: "What actually happened? Give me the real moment."
- For VIBE: Single words (funny, chill, hype) are NOT valid. Push: "Say more — is it dry and self-aware? Vulnerable and honest? Chaotic and loud?"
- For PLATFORM: "Both", "Instagram", "TikTok" all count. These show quick-reply buttons — don't ask differently.
- For DURATION: "15", "30", "60" all count. These also show quick-reply buttons.
- Never ask about music or voiceover — that's automatic.
- Use ${userName}'s first name occasionally to keep it personal.
- When reacting to what they share, make it specific to THEIR answer — not generic encouragement.

CURRENT STATUS:
- Topic: ${projectState.title ? `"${projectState.title}" ✓` : "still needed"}
- Platform: ${projectState.platforms?.length ? `${projectState.platforms.join(" + ")} ✓` : "still needed"}
- Vibe: ${projectState.vibe ? `"${projectState.vibe}" ✓` : "still needed"}
- Duration: ${projectState.duration ? `${projectState.duration}s ✓` : "still needed"}
${knownSoFar ? `\nLocked in so far: ${knownSoFar}` : ""}

NEXT STEP:
${!hasTitle ? "→ Get the TOPIC. Set currentStep: \"title\"." :
  !hasPlatform ? "→ Get the PLATFORM. Set currentStep: \"platform\"." :
  !hasVibe ? "→ Get the VIBE. Set currentStep: \"vibe\"." :
  !hasDuration ? "→ Get the DURATION. Set currentStep: \"duration\"." :
  "→ You have everything! Tell them you're dialed in and ready to build. Set currentStep: \"upload\", needsUpload: true."}

RESPOND WITH ONLY THIS JSON (no markdown, no code fences):
{
  "message": "your 1-2 sentence reply",
  "extracted": {
    "title": null or "the specific topic they gave (only if genuinely descriptive, not vague)",
    "platforms": null or ["instagram"] or ["tiktok"] or ["instagram","tiktok"],
    "vibe": null or "the vibe phrase they gave (only if it's more than one word)",
    "duration": null or 15 or 30 or 60
  },
  "currentStep": "title" or "platform" or "vibe" or "duration" or "upload",
  "needsUpload": false or true
}`;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      max_tokens: 250,
      temperature: 0.85,
      response_format: { type: "json_object" },
    });
  } catch (err) {
    console.error("Chat OpenAI error:", err);
    return NextResponse.json(
      { error: "ai_unavailable", message: "I'm having trouble connecting right now. Give me a second and try again." },
      { status: 503 }
    );
  }

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

  if (!parsed.message) {
    parsed.message = "Sorry, got a bit lost — try again?";
  }

  // Safety: if all collected and not yet upload, force upload step
  if (allCollected && !parsed.needsUpload) {
    parsed.needsUpload = true;
    parsed.currentStep = "upload";
  }

  return NextResponse.json(parsed);
}

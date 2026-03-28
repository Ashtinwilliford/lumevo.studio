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
  mediaType: "voiceover" | "music" | "both" | null;
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
  const brandContext = brand
    ? `Their niche: ${brand.niche || "content creation"}. Voice: ${brand.voice_style || "conversational"}. Audience: ${brand.target_audience || "general"}.`
    : "";

  const knownSoFar = [
    projectState.title ? `Topic: "${projectState.title}"` : null,
    projectState.platforms?.length ? `Platform(s): ${projectState.platforms.join(", ")}` : null,
    projectState.mediaType ? `Media type: ${projectState.mediaType}` : null,
    projectState.vibe ? `Vibe: "${projectState.vibe}"` : null,
    projectState.duration ? `Duration: ${projectState.duration}s` : null,
  ].filter(Boolean).join(" | ");

  const systemPrompt = `You are Lumevo's creative director AI. You're having a warm, natural conversation with ${userName} to plan and launch their next post project.

${brandContext}

Your mission: collect these 5 things naturally through conversation — don't ask for all at once:
1. What the post is about (topic/title)
2. Platform(s): instagram, tiktok, youtube, or multiple
3. Media style: "voiceover" (their cloned voice narrating), "music" (background track only), or "both"
4. Vibe or script direction (mood, feeling, what they want to convey)
5. Duration: 15, 30, or 60 seconds

Rules:
- Be warm, fun, and specific — like a real creative director who knows them
- Use their first name occasionally (${userName})
- One or two questions max per message, never a list of questions
- When they say something like "summer trip to Belize", pull the platform question naturally
- When they say "both" for platforms, confirm and move on
- When you have 4 of the 5 pieces, tell them to upload their media (set needsUpload: true)
- When you have ALL 5 pieces AND they've been prompted to upload, set readyToCreate: true
- Keep messages SHORT — 1-3 sentences max, snappy

Known so far: ${knownSoFar || "nothing yet — just getting started"}

RESPOND WITH ONLY THIS JSON OBJECT (no markdown, no code blocks, pure JSON):
{
  "message": "your short conversational message",
  "extracted": {
    "title": null or "string",
    "platforms": null or ["instagram","tiktok","youtube"],
    "mediaType": null or "voiceover" or "music" or "both",
    "vibe": null or "string describing mood/direction",
    "duration": null or 15 or 30 or 60
  },
  "needsUpload": false,
  "readyToCreate": false
}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ],
    max_tokens: 300,
    temperature: 0.85,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: {
    message: string;
    extracted: Partial<ProjectState>;
    needsUpload: boolean;
    readyToCreate: boolean;
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { message: "Let me think on that — what's the vibe you're going for?", extracted: {}, needsUpload: false, readyToCreate: false };
  }

  return NextResponse.json(parsed);
}

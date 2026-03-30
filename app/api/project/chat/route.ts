import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  timeout: 25000,
});

interface ProjectState {
  title: string | null;
  platforms: string[] | null;
  vibe: string | null;
  duration: number | null;
}

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    messages: { role: string; content: string }[];
    projectState: ProjectState;
    userName: string;
  };

  const { messages, userName } = body;
  // Normalize projectState — platforms may arrive as a string from restored draft state
  const rawState = body.projectState;
  const projectState: ProjectState = {
    ...rawState,
    platforms: Array.isArray(rawState.platforms)
      ? rawState.platforms
      : typeof rawState.platforms === "string" && rawState.platforms
      ? [rawState.platforms]
      : rawState.platforms,
  };

  const brandRows = await query(
    "SELECT tone_summary, personality_summary, platform_focus FROM brand_profiles WHERE user_id = $1",
    [session.id]
  );
  const brand = brandRows.rows[0];
  const brandContext = brand?.tone_summary
    ? `Brand voice: ${brand.tone_summary}.`
    : brand?.personality_summary
    ? `Style: ${brand.personality_summary}.`
    : "";

  const hasTitle = !!projectState.title;
  const hasPlatform = !!(projectState.platforms?.length);
  const hasVibe = !!projectState.vibe;
  const hasDuration = !!projectState.duration;
  const allCollected = hasTitle && hasPlatform && hasVibe && hasDuration;

  const nextStep = !hasTitle ? "Get the TOPIC. currentStep: title" :
    !hasPlatform ? "Get the PLATFORM (Instagram/TikTok/both). currentStep: platform" :
    !hasVibe ? "Get the VIBE — must be a phrase, not one word. currentStep: vibe" :
    !hasDuration ? "Get the DURATION (15/30/60s). currentStep: duration" :
    "All done — tell them you're ready to build. currentStep: upload, needsUpload: true";

  const systemPrompt = `You are Lumevo, a sharp creative director helping ${userName} plan a video. Be direct and warm. 1-2 sentences max per reply.
${brandContext}

Collect in order: TOPIC (specific moment/story, not vague) → PLATFORM → VIBE (phrase not single word) → DURATION.
Status: title=${projectState.title ?? "needed"} | platforms=${projectState.platforms?.join(",") ?? "needed"} | vibe=${projectState.vibe ?? "needed"} | duration=${projectState.duration ?? "needed"}

Next: ${nextStep}

Reply ONLY with JSON (no markdown):
{"message":"...","extracted":{"title":null,"platforms":null,"vibe":null,"duration":null},"currentStep":"title|platform|vibe|duration|upload","needsUpload":false}`;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      max_tokens: 200,
      temperature: 0.8,
      response_format: { type: "json_object" },
    });
  } catch (err) {
    console.error("Chat OpenAI error:", err);
    return NextResponse.json(
      { error: "ai_unavailable", message: "I'm having trouble connecting right now. Give me a second and try again." },
      { status: 503 }
    );
  }

  const aiContent = completion.choices[0]?.message?.content || "{}";
  let parsed: {
    message: string;
    extracted: Partial<ProjectState>;
    currentStep: string;
    needsUpload: boolean;
  };

  try {
    parsed = JSON.parse(aiContent);
  } catch {
    parsed = {
      message: "Got a bit lost — what were we saying?",
      extracted: {},
      currentStep: "title",
      needsUpload: false,
    };
  }

  if (!parsed.message) {
    parsed.message = "Got a bit lost — try again?";
  }

  if (allCollected && !parsed.needsUpload) {
    parsed.needsUpload = true;
    parsed.currentStep = "upload";
  }

  return NextResponse.json(parsed);
}

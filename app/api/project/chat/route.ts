import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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

  const body = await req.json();
  const userName = body.userName || "creator";
  const rawState = body.projectState || {};
  const projectState: ProjectState = {
    title: rawState.title || null,
    platforms: Array.isArray(rawState.platforms) ? rawState.platforms : rawState.platforms ? [rawState.platforms] : null,
    vibe: rawState.vibe || null,
    duration: rawState.duration || null,
  };

  let claudeMessages: { role: "user" | "assistant"; content: string }[] = [];
  if (body.messages && Array.isArray(body.messages)) {
    claudeMessages = body.messages.map((m: { role: string; content: string }) => ({
      role: (m.role === "ai" ? "assistant" : m.role) as "user" | "assistant",
      content: m.content,
    }));
  } else if (body.message) {
    const history = body.history || [];
    claudeMessages = [
      ...history.slice(-8).map((m: { role: string; content: string }) => ({
        role: (m.role === "ai" ? "assistant" : m.role) as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: body.message },
    ];
  }

  if (claudeMessages.length === 0) {
    claudeMessages = [{ role: "user", content: "Hello" }];
  }

  const brandRows = await query(
    "SELECT tone_summary, personality_summary FROM brand_profiles WHERE user_id = $1",
    [session.id]
  );
  const brand = brandRows.rows[0];
  const brandContext = brand?.tone_summary ? `Brand voice: ${brand.tone_summary}.` : "";

  const hasTitle = !!projectState.title;
  const hasPlatform = !!(projectState.platforms?.length);
  const hasVibe = !!projectState.vibe;
  const hasDuration = !!projectState.duration;
  const allCollected = hasTitle && hasPlatform && hasVibe && hasDuration;

  const nextStep = !hasTitle
    ? "Get the TOPIC. currentStep: title"
    : !hasPlatform
    ? "Get the PLATFORM (Instagram/TikTok/both). currentStep: platform"
    : !hasVibe
    ? "Get the VIBE. currentStep: vibe"
    : !hasDuration
    ? "Get the DURATION (15/30/60s). currentStep: duration"
    : "All done. currentStep: upload, needsUpload: true";

  const systemPrompt = `You are Lumevo, a sharp creative director helping ${userName} plan a video. Be direct and warm. 1-2 sentences max.
${brandContext}
Collect: TOPIC -> PLATFORM -> VIBE -> DURATION.
Status: title=${projectState.title ?? "needed"} | platforms=${projectState.platforms?.join(",") ?? "needed"} | vibe=${projectState.vibe ?? "needed"} | duration=${projectState.duration ?? "needed"}
Next: ${nextStep}
Reply ONLY with JSON: {"message":"...","extracted":{"title":null,"platforms":null,"vibe":null,"duration":null},"currentStep":"title|platform|vibe|duration|upload","needsUpload":false}`;

  let completion;
  try {
    completion = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      system: systemPrompt,
      messages: claudeMessages,
    });
  } catch (err) {
    console.error("Claude chat error:", err);
    return NextResponse.json(
      { error: "ai_unavailable", message: "Having trouble connecting. Try again in a moment." },
      { status: 503 }
    );
  }

  const aiContent = completion.content[0]?.type === "text" ? completion.content[0].text : "{}";

  let parsed: { message: string; extracted: Partial<ProjectState>; currentStep: string; needsUpload: boolean };
  try {
    const clean = aiContent.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    parsed = { message: aiContent || "Got a bit lost. What were we saying?", extracted: {}, currentStep: "title", needsUpload: false };
  }

  if (!parsed.message) parsed.message = "Got a bit lost. Try again?";
  if (allCollected && !parsed.needsUpload) {
    parsed.needsUpload = true;
    parsed.currentStep = "upload";
  }

  return NextResponse.json({ ...parsed, reply: parsed.message });
}
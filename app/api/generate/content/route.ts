import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface GenerateRequest {
  title: string;
  description: string;
  vibe: string;
  tone: string;
  audienceGoal: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerateRequest;
  const { title, description, vibe, tone, audienceGoal } = body;

  if (!title && !description) {
    return NextResponse.json({ error: "title or description is required" }, { status: 400 });
  }

  const prompt = `You are an expert short-form video content strategist for social media creators.

Given this content brief:
- Title: ${title}
- Description: ${description}
- Vibe: ${vibe}
- Tone: ${tone}
- Audience goal: ${audienceGoal.replace(/_/g, " ")}

Generate the following and return ONLY valid JSON with these three keys (no markdown, no extra text):

{
  "captions": ["caption1", "caption2", "caption3", "caption4"],
  "titleIdeas": ["title1", "title2", "title3", "title4"],
  "contentStructure": [
    { "label": "Hook", "suggestion": "specific suggestion here", "duration": "0-3s" },
    { "label": "Context", "suggestion": "specific suggestion here", "duration": "3-10s" },
    { "label": "Value Drop", "suggestion": "specific suggestion here", "duration": "10-25s" },
    { "label": "CTA", "suggestion": "specific suggestion here", "duration": "25-30s" }
  ]
}

Rules:
- captions: 4 engaging social media captions with relevant emojis and 2-3 hashtags each
- titleIdeas: 4 punchy video title ideas suited for the vibe and tone
- contentStructure: specific, actionable suggestions for this creator's exact content — not generic advice`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const clean = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Claude captions/titles generation error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}

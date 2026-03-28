import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
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

Generate the following in JSON format:
1. "captions" - array of 4 engaging social media captions (include relevant emojis and 2-3 hashtags each)
2. "titleIdeas" - array of 4 punchy video title ideas suited for the vibe and tone
3. "contentStructure" - array of 4 objects, each with:
   - "label": the section name (Hook, Context, Value Drop, CTA)
   - "suggestion": a specific, actionable suggestion for this creator's content
   - "duration": suggested screen time (e.g. "0-3s")

Return only valid JSON with those three keys, no markdown or extra text.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_completion_tokens: 8192,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return NextResponse.json({ error: "No content generated" }, { status: 500 });
  }

  const result = JSON.parse(content);
  return NextResponse.json(result);
}

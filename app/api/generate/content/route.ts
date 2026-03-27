import { NextRequest, NextResponse } from "next/server";

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

  const mock = {
    captions: [
      `${title} just hit different ✨ #${vibe}vibes`,
      `POV: you finally found your ${tone} era 🙌`,
      `This one's for the ${audienceGoal.replace("_", " ")} gang 💫`,
      `The way this turned out... I can't 😭🔥`,
    ],
    titleIdeas: [
      `My ${vibe} ${title} era`,
      `You NEED to try this`,
      `Wait for it... 👀`,
      `The honest truth about ${description.split(" ").slice(0, 3).join(" ")}`,
    ],
    contentStructure: [
      {
        label: "Hook",
        suggestion: `Open with a bold statement or surprising visual related to "${title}". Grab attention in the first 0–2 seconds.`,
        duration: "0–3s",
      },
      {
        label: "Context",
        suggestion: `Quickly explain the setup: ${description.slice(0, 80)}…`,
        duration: "3–8s",
      },
      {
        label: "Value Drop",
        suggestion: `Deliver the main insight or moment. Match the ${vibe} energy — this is the shareable part.`,
        duration: "8–20s",
      },
      {
        label: "CTA",
        suggestion: `Close with a clear ask that supports your goal: ${audienceGoal.replace("_", " ")}. Keep it natural and on-brand.`,
        duration: "20–30s",
      },
    ],
  };

  return NextResponse.json(mock);
}

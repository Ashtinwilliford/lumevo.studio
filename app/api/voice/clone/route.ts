import { NextRequest, NextResponse } from "next/server";
import { ReplitConnectors } from "@replit/connectors-sdk";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const name = form.get("name") as string;
  const files = form.getAll("files") as File[];

  if (!name || files.length === 0) {
    return NextResponse.json({ error: "Voice name and at least one audio file are required." }, { status: 400 });
  }

  const elForm = new FormData();
  elForm.append("name", name);
  elForm.append("description", `Voice clone for ${name}`);
  for (const file of files) {
    elForm.append("files", file, file.name);
  }

  const connectors = new ReplitConnectors();
  const res = await connectors.proxy("elevenlabs", "/v1/voices/add", {
    method: "POST",
    body: elForm,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("ElevenLabs clone error:", err);
    return NextResponse.json({ error: "Voice cloning failed. Check your ElevenLabs account." }, { status: res.status });
  }

  const data = await res.json() as { voice_id: string };
  return NextResponse.json({ voiceId: data.voice_id });
}

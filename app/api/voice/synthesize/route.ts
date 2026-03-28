import { NextRequest, NextResponse } from "next/server";
import { ReplitConnectors } from "@replit/connectors-sdk";

export async function POST(req: NextRequest) {
  const { voiceId, text } = (await req.json()) as { voiceId: string; text: string };

  if (!voiceId || !text) {
    return NextResponse.json({ error: "voiceId and text are required." }, { status: 400 });
  }

  const connectors = new ReplitConnectors();
  const res = await connectors.proxy("elevenlabs", `/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.8 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("ElevenLabs TTS error:", err);
    return NextResponse.json({ error: "Speech synthesis failed." }, { status: res.status });
  }

  const audioBuffer = await res.arrayBuffer();
  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuffer.byteLength),
    },
  });
}

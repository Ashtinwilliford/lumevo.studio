import { NextRequest, NextResponse } from "next/server";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRes = await query("SELECT subscription_tier FROM users WHERE id = $1", [session.id]);
  const tier = userRes.rows[0]?.subscription_tier as string | undefined;
  if (tier !== "elite") return NextResponse.json({ error: "Elite plan required" }, { status: 403 });

  const body = await req.json() as {
    cloneName: string;
    samples: { name: string; mimeType: string; base64: string }[];
  };
  const { cloneName, samples } = body;

  if (!cloneName?.trim()) return NextResponse.json({ error: "A name for your voice clone is required." }, { status: 400 });
  if (!samples?.length) return NextResponse.json({ error: "At least one audio or video sample is required." }, { status: 400 });

  const elForm = new FormData();
  elForm.append("name", cloneName.trim());
  elForm.append("description", `Lumevo Studio voice clone — ${cloneName.trim()}`);

  for (const sample of samples) {
    const binary = Buffer.from(sample.base64, "base64");
    const blob = new Blob([binary], { type: sample.mimeType || "audio/mpeg" });
    elForm.append("files", blob, sample.name);
  }

  const connectors = new ReplitConnectors();
  const res = await connectors.proxy("elevenlabs", "/v1/voices/add", {
    method: "POST",
    body: elForm,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("ElevenLabs clone error:", errText);
    return NextResponse.json({ error: "Voice cloning failed. Make sure your samples are clear audio recordings (1+ minute total)." }, { status: 500 });
  }

  const data = await res.json() as { voice_id: string };
  const voiceId = data.voice_id;

  await query(
    "UPDATE users SET elevenlabs_voice_id = $1, voice_clone_name = $2 WHERE id = $3",
    [voiceId, cloneName.trim(), session.id]
  );

  return NextResponse.json({ voiceId, cloneName: cloneName.trim() });
}

export async function DELETE() {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await query(
    "UPDATE users SET elevenlabs_voice_id = NULL, voice_clone_name = NULL WHERE id = $1",
    [session.id]
  );

  return NextResponse.json({ ok: true });
}

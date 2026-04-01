import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const renderId = req.nextUrl.searchParams.get("renderId");
  if (!renderId) return NextResponse.json({ error: "renderId required" }, { status: 400 });

  const apiKey = process.env.CREATOMATE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  try {
    const res = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    const data = await res.json();
    return NextResponse.json({
      status: data.status,  // "planned", "rendering", "succeeded", "failed"
      url: data.url,
      errorMessage: data.error_message || null,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}

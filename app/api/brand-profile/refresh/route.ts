import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

const TONE_LABELS = ["Witty & punchy", "Warm & educational", "Bold & direct", "Inspirational", "Conversational", "Professional"];
const PERSONALITY_LABELS = ["Authentic storyteller", "Expert authority", "Relatable creator", "Trend-forward", "Community-builder"];
const AUDIENCE_LABELS = ["Young ambitious women", "Entrepreneurs 25-40", "Creative professionals", "Lifestyle enthusiasts", "Business-minded creators"];
const PACING_LABELS = ["Fast-paced & dynamic", "Steady & informative", "Rhythmic with beats", "Slow & cinematic"];
const CTA_LABELS = ["Save this", "Comment your thoughts", "Follow for more", "DM me", "Share with someone who needs this"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const uploads = await query(`SELECT COUNT(*) as cnt FROM uploads WHERE user_id = $1`, [session.id]);
  const generations = await query(`SELECT COUNT(*) as cnt FROM generated_contents WHERE user_id = $1`, [session.id]);

  const uploadCount = parseInt(uploads.rows[0].cnt);
  const generationCount = parseInt(generations.rows[0].cnt);

  const progress = Math.min(100, uploadCount * 5 + generationCount * 3);
  const confidence = Math.min(100, uploadCount * 4 + generationCount * 2);

  const result = await query(
    `UPDATE brand_profiles SET
       tone_summary = $1,
       personality_summary = $2,
       audience_summary = $3,
       pacing_style = $4,
       cta_style = $5,
       learning_progress_percent = $6,
       confidence_score = $7,
       upload_count = $8,
       generation_count = $9,
       updated_at = NOW()
     WHERE user_id = $10
     RETURNING *`,
    [
      pick(TONE_LABELS), pick(PERSONALITY_LABELS), pick(AUDIENCE_LABELS),
      pick(PACING_LABELS), pick(CTA_LABELS),
      progress, confidence, uploadCount, generationCount, session.id
    ]
  );

  return NextResponse.json({ brand_profile: result.rows[0] });
}

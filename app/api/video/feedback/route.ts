import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

// Quick feedback actions and how they modify the style profile
const STYLE_ADJUSTMENTS: Record<string, Record<string, string>> = {
  "more_trendy": { music_energy: "trendy", vibe_keywords: "trendy" },
  "more_luxe": { color_grade: "warm", music_energy: "cinematic", caption_style: "minimal" },
  "faster_pace": { pacing: "fast", transition_density: "quick" },
  "slower_pace": { pacing: "slow", transition_density: "smooth" },
  "stronger_hook": { preferred_hooks: "bold visual impact" },
  "less_text": { text_amount: "minimal", caption_style: "minimal" },
  "more_text": { text_amount: "moderate", caption_style: "descriptive" },
  "better_music": { music_energy: "cinematic emotional" },
  "more_cinematic": { color_grade: "dramatic", pacing: "medium", transition_density: "smooth" },
  "more_energy": { pacing: "fast", music_energy: "energetic" },
  "more_personal": { voiceover_preference: "voice_clone", caption_style: "conversational" },
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, feedback } = await req.json() as { projectId: string; feedback: string };
  if (!feedback) return NextResponse.json({ error: "feedback required" }, { status: 400 });

  const userId = session.id;

  // Log feedback
  await query(
    `INSERT INTO project_feedback (user_id, project_id, action, context)
     VALUES ($1, $2, 'video_feedback', $3)`,
    [userId, projectId || null, JSON.stringify({ feedback })]
  );

  // Apply style adjustments
  const adjustments = STYLE_ADJUSTMENTS[feedback];
  if (adjustments) {
    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    for (const [key, val] of Object.entries(adjustments)) {
      if (key === "vibe_keywords" || key === "preferred_hooks") {
        // Append to array
        updates.push(`${key} = array_append(COALESCE(${key}, '{}'), $${i++})`);
        values.push(val);
      } else {
        updates.push(`${key} = $${i++}`);
        values.push(val);
      }
    }

    updates.push("updated_at = now()");
    values.push(userId);

    await query(
      `UPDATE creator_styles SET ${updates.join(", ")} WHERE user_id = $${i}`,
      values
    );
  }

  return NextResponse.json({ ok: true, feedback, adjustmentsApplied: !!adjustments });
}

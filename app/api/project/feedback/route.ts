import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

// Valid feedback actions and what they signal about the creator
const ACTION_SIGNALS: Record<string, { sentiment: number; meaning: string }> = {
  download:      { sentiment: 1.0,  meaning: "loved output — keep this style" },
  thumbs_up:     { sentiment: 0.8,  meaning: "strong approval of content" },
  share:         { sentiment: 0.9,  meaning: "proud enough to share publicly" },
  edited:        { sentiment: 0.3,  meaning: "liked direction, adjusted details" },
  regenerate:    { sentiment: -0.5, meaning: "dissatisfied — try different approach" },
  thumbs_down:   { sentiment: -0.8, meaning: "strong rejection — major style miss" },
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, action, context } = await req.json() as {
    projectId?: string;
    action: string;
    context?: Record<string, unknown>;
  };

  if (!action || !ACTION_SIGNALS[action]) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const userId = session.id;
  const signal = ACTION_SIGNALS[action];

  // 1. Log the feedback event
  await query(
    `INSERT INTO project_feedback (user_id, project_id, action, context)
     VALUES ($1, $2, $3, $4)`,
    [userId, projectId || null, action, JSON.stringify(context || {})]
  );

  // 2. Update brand_profile feedback summary atomically
  await query(
    `UPDATE brand_profiles
     SET feedback_summary = jsonb_set(
       COALESCE(feedback_summary, '{}'::jsonb),
       '{${action}s}',
       to_jsonb(COALESCE((feedback_summary->>'${action}s')::int, 0) + 1)
     ),
     updated_at = now()
     WHERE user_id = $1`,
    [userId]
  );

  // 3. If strong signal, add learning insight
  if (Math.abs(signal.sentiment) >= 0.7 && projectId) {
    const projectRows = await query(
      `SELECT title, target_platform, vibe, generated_content, timeline
       FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, userId]
    );
    const project = projectRows.rows[0] as Record<string, unknown> | undefined;

    if (project) {
      await query(
        `INSERT INTO learning_insights (user_id, insight_type, insight_data, confidence, source)
         VALUES ($1, $2, $3, $4, 'feedback')`,
        [
          userId,
          signal.sentiment > 0 ? "positive_style_signal" : "negative_style_signal",
          JSON.stringify({
            action,
            meaning: signal.meaning,
            sentiment: signal.sentiment,
            projectTitle: project.title,
            platform: project.target_platform,
            vibe: project.vibe,
            timeline: project.timeline,
          }),
          Math.abs(signal.sentiment),
        ]
      );
    }
  }

  // 4. Trigger async brand re-learning if enough feedback accumulated
  const feedbackCount = await query(
    `SELECT COUNT(*) as cnt FROM project_feedback WHERE user_id = $1 AND created_at > now() - interval '7 days'`,
    [userId]
  );
  const recentFeedback = parseInt((feedbackCount.rows[0] as { cnt: string }).cnt);

  if (recentFeedback % 3 === 0) {
    // Fire and forget — don't await, just trigger learning
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5000"}/api/brand/learn`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: req.headers.get("cookie") || "" },
      body: JSON.stringify({ trigger: "feedback_threshold" }),
    }).catch(() => null);
  }

  return NextResponse.json({
    logged: true,
    signal: signal.meaning,
    learningTriggered: recentFeedback % 3 === 0,
  });
}

export async function GET() {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [feedbackRows, insightRows] = await Promise.all([
    query(
      `SELECT action, COUNT(*) as cnt FROM project_feedback
       WHERE user_id = $1 GROUP BY action`,
      [session.id]
    ),
    query(
      `SELECT insight_type, insight_data, confidence, created_at
       FROM learning_insights WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [session.id]
    ),
  ]);

  return NextResponse.json({
    feedback: feedbackRows.rows,
    insights: insightRows.rows,
  });
}

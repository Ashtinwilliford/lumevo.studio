import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

export const maxDuration = 30;

// POST: create or update a draft project (called as soon as user names a project)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await req.json() as {
    projectId?: string;
    title?: string;
    chat_history?: Array<{ role: string; content: string }>;
    draft_state?: Record<string, unknown>;
    status?: string;
  };

  const { projectId, title, chat_history, draft_state, status } = body;

  if (projectId) {
    // Update existing draft
    await query(
      `UPDATE projects
       SET title = COALESCE($1, title),
           chat_history = COALESCE($2, chat_history),
           draft_state  = COALESCE($3, draft_state),
           status       = COALESCE($4, status),
           updated_at   = now()
       WHERE id = $5 AND user_id = $6`,
      [
        title ?? null,
        chat_history ? JSON.stringify(chat_history) : null,
        draft_state ? JSON.stringify(draft_state) : null,
        status ?? null,
        projectId,
        session.id,
      ]
    );
    return NextResponse.json({ projectId });
  }

  // Create new draft
  if (!title?.trim()) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO projects
       (user_id, title, status, chat_history, draft_state)
     VALUES ($1, $2, 'chatting', $3, $4)
     RETURNING id`,
    [
      session.id,
      title.trim(),
      JSON.stringify(chat_history ?? []),
      JSON.stringify(draft_state ?? {}),
    ]
  );

  const newId = (result.rows[0] as { id: string }).id;
  return NextResponse.json({ projectId: newId });
}

// GET: fetch a single project with chat history (for resuming)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("id");
  if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const result = await query(
    `SELECT id, title, status, chat_history, draft_state, created_at
     FROM projects
     WHERE id = $1 AND user_id = $2`,
    [projectId, session.id]
  );

  if (!result.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ project: result.rows[0] });
}

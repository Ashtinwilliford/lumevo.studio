import { query } from "./db";

export async function logStage(
  projectId: string,
  userId: string,
  stage: string,
  payload: unknown,
  result: unknown,
  error?: string,
  durationMs?: number
) {
  try {
    await query(
      `INSERT INTO generation_logs (project_id, user_id, stage, payload, result, error, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        projectId,
        userId,
        stage,
        JSON.stringify(payload),
        JSON.stringify(result),
        error || null,
        durationMs || null,
      ]
    );
  } catch (err) {
    console.error("Failed to log generation stage:", err);
  }
}

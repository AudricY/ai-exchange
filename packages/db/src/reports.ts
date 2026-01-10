import type { ForensicsReport } from '@ai-exchange/types';
import { getDb } from './connection.js';

export function saveReport(sessionId: string, report: ForensicsReport): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT OR REPLACE INTO reports (session_id, report, generated_at)
     VALUES (?, ?, ?)`
  ).run(sessionId, JSON.stringify(report), now);
}

export function getReport(sessionId: string): ForensicsReport | null {
  const db = getDb();
  const row = db
    .prepare('SELECT report FROM reports WHERE session_id = ?')
    .get(sessionId) as { report: string } | undefined;

  if (!row) return null;
  return JSON.parse(row.report) as ForensicsReport;
}

export function listReports(): Array<{
  sessionId: string;
  report: ForensicsReport;
  generatedAt: string;
}> {
  const db = getDb();
  const rows = db
    .prepare('SELECT session_id, report, generated_at FROM reports ORDER BY generated_at DESC')
    .all() as Array<{ session_id: string; report: string; generated_at: string }>;

  return rows.map((row) => ({
    sessionId: row.session_id,
    report: JSON.parse(row.report) as ForensicsReport,
    generatedAt: row.generated_at,
  }));
}

export function getReportStatuses(
  sessionIds: string[]
): Map<string, { generatedAt: string }> {
  const db = getDb();
  const result = new Map<string, { generatedAt: string }>();

  if (sessionIds.length === 0) return result;

  const placeholders = sessionIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT session_id, generated_at FROM reports WHERE session_id IN (${placeholders})`
    )
    .all(...sessionIds) as Array<{ session_id: string; generated_at: string }>;

  for (const row of rows) {
    result.set(row.session_id, { generatedAt: row.generated_at });
  }

  return result;
}

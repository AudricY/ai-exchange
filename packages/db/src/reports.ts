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

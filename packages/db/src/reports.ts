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

export type InvestigationStatus = 'idle' | 'running' | 'completed' | 'failed';

export function setInvestigationStatus(
  sessionId: string,
  status: InvestigationStatus
): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO investigation_status (session_id, status, started_at)
     VALUES (?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       status = excluded.status,
       started_at = CASE WHEN excluded.status = 'running' THEN excluded.started_at ELSE started_at END`
  ).run(sessionId, status, status === 'running' ? now : null);
}

export function getInvestigationStatus(
  sessionId: string
): { status: InvestigationStatus; startedAt: string | null } | null {
  const db = getDb();
  const row = db
    .prepare('SELECT status, started_at FROM investigation_status WHERE session_id = ?')
    .get(sessionId) as { status: string; started_at: string | null } | undefined;

  if (!row) return null;
  return {
    status: row.status as InvestigationStatus,
    startedAt: row.started_at,
  };
}

export function getReportStatuses(
  sessionIds: string[]
): Map<string, { generatedAt?: string; status: InvestigationStatus }> {
  const db = getDb();
  const result = new Map<string, { generatedAt?: string; status: InvestigationStatus }>();

  if (sessionIds.length === 0) return result;

  const placeholders = sessionIds.map(() => '?').join(',');

  // Get reports
  const reportRows = db
    .prepare(
      `SELECT session_id, generated_at FROM reports WHERE session_id IN (${placeholders})`
    )
    .all(...sessionIds) as Array<{ session_id: string; generated_at: string }>;

  // Get statuses
  const statusRows = db
    .prepare(
      `SELECT session_id, status FROM investigation_status WHERE session_id IN (${placeholders})`
    )
    .all(...sessionIds) as Array<{ session_id: string; status: string }>;

  // Build status map
  const statusMap = new Map<string, InvestigationStatus>();
  for (const row of statusRows) {
    statusMap.set(row.session_id, row.status as InvestigationStatus);
  }

  // Combine results
  for (const sessionId of sessionIds) {
    const reportRow = reportRows.find((r) => r.session_id === sessionId);
    const status = statusMap.get(sessionId) ?? 'idle';

    result.set(sessionId, {
      generatedAt: reportRow?.generated_at,
      status,
    });
  }

  return result;
}

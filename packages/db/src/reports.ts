import type { ForensicsReport } from '@ai-exchange/types';
import { getDb } from './connection.js';

export function generateInvestigationId(sessionId: string): string {
  return `inv-${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function saveReport(
  investigationId: string,
  sessionId: string,
  report: ForensicsReport,
  title?: string
): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT OR REPLACE INTO reports (id, session_id, title, report, generated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    investigationId,
    sessionId,
    title ?? `Investigation ${new Date().toLocaleString()}`,
    JSON.stringify(report),
    now
  );
}

export function getReport(investigationId: string): ForensicsReport | null {
  const db = getDb();
  const row = db
    .prepare('SELECT report FROM reports WHERE id = ?')
    .get(investigationId) as { report: string } | undefined;

  if (!row) return null;
  return JSON.parse(row.report) as ForensicsReport;
}

export function getSessionReports(sessionId: string): Array<{
  id: string;
  title: string;
  report: ForensicsReport;
  generatedAt: string;
}> {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT id, title, report, generated_at FROM reports WHERE session_id = ? ORDER BY generated_at DESC'
    )
    .all(sessionId) as Array<{
      id: string;
      title: string;
      report: string;
      generated_at: string;
    }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    report: JSON.parse(row.report) as ForensicsReport,
    generatedAt: row.generated_at,
  }));
}

export function listReports(): Array<{
  id: string;
  sessionId: string;
  title: string;
  report: ForensicsReport;
  generatedAt: string;
}> {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT id, session_id, title, report, generated_at FROM reports ORDER BY generated_at DESC'
    )
    .all() as Array<{
      id: string;
      session_id: string;
      title: string;
      report: string;
      generated_at: string;
    }>;

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    report: JSON.parse(row.report) as ForensicsReport,
    generatedAt: row.generated_at,
  }));
}

export type InvestigationStatus = 'idle' | 'running' | 'completed' | 'failed';

export function setInvestigationStatus(
  investigationId: string,
  sessionId: string,
  status: InvestigationStatus
): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO investigation_status (id, session_id, status, started_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status`
  ).run(investigationId, sessionId, status, now);
}

export function getInvestigationStatus(
  investigationId: string
): { status: InvestigationStatus; sessionId: string; startedAt: string } | null {
  const db = getDb();
  const row = db
    .prepare('SELECT session_id, status, started_at FROM investigation_status WHERE id = ?')
    .get(investigationId) as {
      session_id: string;
      status: string;
      started_at: string;
    } | undefined;

  if (!row) return null;
  return {
    sessionId: row.session_id,
    status: row.status as InvestigationStatus,
    startedAt: row.started_at,
  };
}

export function getRunningInvestigations(sessionId: string): Array<{
  id: string;
  status: InvestigationStatus;
  startedAt: string;
}> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, status, started_at FROM investigation_status
       WHERE session_id = ? AND status = 'running'`
    )
    .all(sessionId) as Array<{
      id: string;
      status: string;
      started_at: string;
    }>;

  return rows.map((row) => ({
    id: row.id,
    status: row.status as InvestigationStatus,
    startedAt: row.started_at,
  }));
}

export function getReportStatuses(
  sessionIds: string[]
): Map<string, { count: number; latestGeneratedAt?: string; hasRunning: boolean }> {
  const db = getDb();
  const result = new Map<string, { count: number; latestGeneratedAt?: string; hasRunning: boolean }>();

  if (sessionIds.length === 0) return result;

  const placeholders = sessionIds.map(() => '?').join(',');

  // Get report counts and latest date per session
  const reportRows = db
    .prepare(
      `SELECT session_id, COUNT(*) as count, MAX(generated_at) as latest
       FROM reports WHERE session_id IN (${placeholders})
       GROUP BY session_id`
    )
    .all(...sessionIds) as Array<{
      session_id: string;
      count: number;
      latest: string;
    }>;

  // Get running status per session
  const runningRows = db
    .prepare(
      `SELECT session_id, COUNT(*) as count
       FROM investigation_status
       WHERE session_id IN (${placeholders}) AND status = 'running'
       GROUP BY session_id`
    )
    .all(...sessionIds) as Array<{ session_id: string; count: number }>;

  const runningMap = new Map(runningRows.map((r) => [r.session_id, r.count > 0]));

  for (const sessionId of sessionIds) {
    const reportRow = reportRows.find((r) => r.session_id === sessionId);
    result.set(sessionId, {
      count: reportRow?.count ?? 0,
      latestGeneratedAt: reportRow?.latest,
      hasRunning: runningMap.get(sessionId) ?? false,
    });
  }

  return result;
}

import type { Session, SessionConfig } from '@ai-exchange/types';
import { getDb } from './connection.js';

export function createSession(
  id: string,
  name: string,
  config: SessionConfig
): Session {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO sessions (id, name, status, config, created_at, event_count, trade_count)
     VALUES (?, ?, 'pending', ?, ?, 0, 0)`
  ).run(id, name, JSON.stringify(config), now);

  return {
    id,
    name,
    status: 'pending',
    config,
    createdAt: now,
    eventCount: 0,
    tradeCount: 0,
  };
}

export function getSession(id: string): Session | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(id) as SessionRow | undefined;

  if (!row) return null;

  return rowToSession(row);
}

export function listSessions(): Session[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM sessions ORDER BY created_at DESC')
    .all() as SessionRow[];

  return rows.map(rowToSession);
}

export function updateSessionStatus(
  id: string,
  status: Session['status'],
  updates?: {
    eventCount?: number;
    tradeCount?: number;
    finalPrice?: number;
    completedAt?: string;
  }
): void {
  const db = getDb();
  const sets = ['status = ?'];
  const params: (string | number)[] = [status];

  if (updates?.eventCount !== undefined) {
    sets.push('event_count = ?');
    params.push(updates.eventCount);
  }
  if (updates?.tradeCount !== undefined) {
    sets.push('trade_count = ?');
    params.push(updates.tradeCount);
  }
  if (updates?.finalPrice !== undefined) {
    sets.push('final_price = ?');
    params.push(updates.finalPrice);
  }
  if (updates?.completedAt !== undefined) {
    sets.push('completed_at = ?');
    params.push(updates.completedAt);
  }

  params.push(id);
  db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`).run(
    ...params
  );
}

export function deleteSession(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

interface SessionRow {
  id: string;
  name: string;
  status: string;
  config: string;
  created_at: string;
  completed_at: string | null;
  event_count: number;
  trade_count: number;
  final_price: number | null;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    name: row.name,
    status: row.status as Session['status'],
    config: JSON.parse(row.config),
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    eventCount: row.event_count,
    tradeCount: row.trade_count,
    finalPrice: row.final_price ?? undefined,
  };
}

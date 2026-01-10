import type { OrderBookSnapshot } from '@ai-exchange/types';
import { getDb } from './connection.js';

export function insertSnapshot(
  sessionId: string,
  timestamp: number,
  snapshot: OrderBookSnapshot
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO book_snapshots (session_id, timestamp, snapshot)
     VALUES (?, ?, ?)`
  ).run(sessionId, timestamp, JSON.stringify(snapshot));
}

export function getSnapshots(
  sessionId: string,
  startTime?: number,
  endTime?: number,
  limit?: number
): OrderBookSnapshot[] {
  const db = getDb();
  const conditions = ['session_id = ?'];
  const params: (string | number)[] = [sessionId];

  if (startTime !== undefined) {
    conditions.push('timestamp >= ?');
    params.push(startTime);
  }
  if (endTime !== undefined) {
    conditions.push('timestamp <= ?');
    params.push(endTime);
  }

  let query = `SELECT snapshot FROM book_snapshots
               WHERE ${conditions.join(' AND ')}
               ORDER BY timestamp ASC`;

  if (limit !== undefined) {
    query += ' LIMIT ?';
    params.push(limit);
  }

  const rows = db.prepare(query).all(...params) as { snapshot: string }[];
  return rows.map((r) => JSON.parse(r.snapshot) as OrderBookSnapshot);
}

export function getSnapshotAt(
  sessionId: string,
  timestamp: number
): OrderBookSnapshot | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT snapshot FROM book_snapshots
       WHERE session_id = ? AND timestamp <= ?
       ORDER BY timestamp DESC
       LIMIT 1`
    )
    .get(sessionId, timestamp) as { snapshot: string } | undefined;

  if (!row) return null;
  return JSON.parse(row.snapshot) as OrderBookSnapshot;
}

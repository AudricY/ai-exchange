import type { OHLCVBar } from '@ai-exchange/types';
import { getDb } from './connection.js';

export function insertOHLCV(bar: OHLCVBar): void {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO ohlcv
     (session_id, interval_start, resolution, open, high, low, close, volume, trade_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    bar.sessionId,
    bar.intervalStart,
    bar.resolution,
    bar.open,
    bar.high,
    bar.low,
    bar.close,
    bar.volume,
    bar.tradeCount
  );
}

export function getOHLCV(
  sessionId: string,
  resolution: number,
  startTime?: number,
  endTime?: number
): OHLCVBar[] {
  const db = getDb();
  const conditions = ['session_id = ?', 'resolution = ?'];
  const params: (string | number)[] = [sessionId, resolution];

  if (startTime !== undefined) {
    conditions.push('interval_start >= ?');
    params.push(startTime);
  }
  if (endTime !== undefined) {
    conditions.push('interval_start <= ?');
    params.push(endTime);
  }

  const rows = db
    .prepare(
      `SELECT * FROM ohlcv
       WHERE ${conditions.join(' AND ')}
       ORDER BY interval_start ASC`
    )
    .all(...params) as OHLCVRow[];

  return rows.map(rowToOHLCV);
}

interface OHLCVRow {
  session_id: string;
  interval_start: number;
  resolution: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trade_count: number;
}

function rowToOHLCV(row: OHLCVRow): OHLCVBar {
  return {
    sessionId: row.session_id,
    intervalStart: row.interval_start,
    resolution: row.resolution,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    tradeCount: row.trade_count,
  };
}

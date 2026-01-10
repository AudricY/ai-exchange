import type { TapeEvent, TapeEventType } from '@ai-exchange/types';
import { getDb } from './connection.js';
import { createReadStream, existsSync } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';

export function indexTapeEvent(
  sessionId: string,
  eventId: string,
  eventType: TapeEventType,
  timestamp: number,
  sequence: number,
  fileOffset: number
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO tape_index (session_id, event_id, event_type, timestamp, sequence, file_offset)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(sessionId, eventId, eventType, timestamp, sequence, fileOffset);
}

export interface TapeFetchOptions {
  sessionId: string;
  startTime?: number;
  endTime?: number;
  eventIds?: string[];
  eventTypes?: TapeEventType[];
  limit?: number;
  offset?: number;
}

export async function fetchTapeEvents(
  options: TapeFetchOptions
): Promise<TapeEvent[]> {
  const {
    sessionId,
    startTime,
    endTime,
    eventIds,
    eventTypes,
    limit = 100,
    offset = 0,
  } = options;

  // If fetching by event IDs, use index
  if (eventIds && eventIds.length > 0) {
    return fetchByEventIds(sessionId, eventIds);
  }

  const db = getDb();
  const conditions: string[] = ['session_id = ?'];
  const params: (string | number)[] = [sessionId];

  if (startTime !== undefined) {
    conditions.push('timestamp >= ?');
    params.push(startTime);
  }
  if (endTime !== undefined) {
    conditions.push('timestamp <= ?');
    params.push(endTime);
  }
  if (eventTypes && eventTypes.length > 0) {
    conditions.push(`event_type IN (${eventTypes.map(() => '?').join(', ')})`);
    params.push(...eventTypes);
  }

  params.push(limit, offset);

  const rows = db
    .prepare(
      `SELECT file_offset FROM tape_index
       WHERE ${conditions.join(' AND ')}
       ORDER BY sequence ASC
       LIMIT ? OFFSET ?`
    )
    .all(...params) as { file_offset: number }[];

  const offsets = rows.map((r) => r.file_offset);
  return readEventsAtOffsets(sessionId, offsets);
}

async function fetchByEventIds(
  sessionId: string,
  eventIds: string[]
): Promise<TapeEvent[]> {
  const db = getDb();
  const placeholders = eventIds.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT file_offset FROM tape_index
       WHERE session_id = ? AND event_id IN (${placeholders})
       ORDER BY sequence ASC`
    )
    .all(sessionId, ...eventIds) as { file_offset: number }[];

  const offsets = rows.map((r) => r.file_offset);
  return readEventsAtOffsets(sessionId, offsets);
}

async function readEventsAtOffsets(
  sessionId: string,
  offsets: number[]
): Promise<TapeEvent[]> {
  if (offsets.length === 0) return [];

  const tapePath = join(process.cwd(), 'data', 'sessions', sessionId, 'tape.jsonl');
  if (!existsSync(tapePath)) return [];

  // For simplicity, read line by line and filter by offset
  // A more efficient implementation would use random access
  const events: TapeEvent[] = [];
  const offsetSet = new Set(offsets);
  let currentOffset = 0;

  const rl = createInterface({
    input: createReadStream(tapePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (offsetSet.has(currentOffset)) {
      events.push(JSON.parse(line) as TapeEvent);
    }
    currentOffset += Buffer.byteLength(line, 'utf8') + 1; // +1 for newline
  }

  return events;
}

export async function fetchAllTapeEvents(sessionId: string): Promise<TapeEvent[]> {
  const tapePath = join(process.cwd(), 'data', 'sessions', sessionId, 'tape.jsonl');
  if (!existsSync(tapePath)) return [];

  const events: TapeEvent[] = [];
  const rl = createInterface({
    input: createReadStream(tapePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim()) {
      events.push(JSON.parse(line) as TapeEvent);
    }
  }

  return events;
}

export function getTapeEventCount(sessionId: string): number {
  const db = getDb();
  const row = db
    .prepare('SELECT COUNT(*) as count FROM tape_index WHERE session_id = ?')
    .get(sessionId) as { count: number };
  return row.count;
}

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

let db: Database.Database | null = null;

const SCHEMA = `
-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  config TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  event_count INTEGER DEFAULT 0,
  trade_count INTEGER DEFAULT 0,
  final_price REAL
);

-- Tape event index for fast range queries
CREATE TABLE IF NOT EXISTS tape_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  sequence INTEGER NOT NULL,
  file_offset INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_tape_session_time ON tape_index(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_tape_session_type ON tape_index(session_id, event_type);
CREATE INDEX IF NOT EXISTS idx_tape_event_id ON tape_index(event_id);

-- OHLCV aggregates
CREATE TABLE IF NOT EXISTS ohlcv (
  session_id TEXT NOT NULL,
  interval_start INTEGER NOT NULL,
  resolution INTEGER NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  trade_count INTEGER NOT NULL,
  PRIMARY KEY (session_id, resolution, interval_start),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Book snapshots
CREATE TABLE IF NOT EXISTS book_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_session_time ON book_snapshots(session_id, timestamp);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  inject_timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Document chunks
CREATE TABLE IF NOT EXISTS doc_chunks (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  FOREIGN KEY (doc_id) REFERENCES documents(id)
);

-- Reports (multiple per session)
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Investigation',
  report TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_session ON reports(session_id);

-- Investigation status tracking (by investigation id)
CREATE TABLE IF NOT EXISTS investigation_status (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_investigation_status_session ON investigation_status(session_id);
`;

export function getDb(dbPath?: string): Database.Database {
  if (db) return db;

  // Use absolute path to avoid issues with process.cwd()
  const cwd = process.cwd();
  const dbFilePath = dbPath ?? `${cwd}/data/exchange.db`;

  // Ensure directory exists
  const dir = dirname(dbFilePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbFilePath);
  db.pragma('journal_mode = WAL');

  // Run schema
  db.exec(SCHEMA);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

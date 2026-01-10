import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (db) return db;

  const path = dbPath ?? join(process.cwd(), 'data', 'exchange.db');
  db = new Database(path);
  db.pragma('journal_mode = WAL');

  // Run migrations
  const migrationPath = join(__dirname, 'migrations', '001-init.sql');
  try {
    const migration = readFileSync(migrationPath, 'utf-8');
    db.exec(migration);
  } catch {
    // In production, migrations will be in dist folder
    const distMigrationPath = join(__dirname, '..', 'src', 'migrations', '001-init.sql');
    const migration = readFileSync(distMigrationPath, 'utf-8');
    db.exec(migration);
  }

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

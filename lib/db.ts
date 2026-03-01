/**
 * SQLite-backed scan log — replaces the race-prone data/scans.json approach.
 * better-sqlite3 is synchronous and serialises writes automatically,
 * eliminating the read-modify-write race condition.
 *
 * Upgrade path: swap driver for @prisma/client + Postgres when scale requires it.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "scans.db");

let db: Database.Database;

export function initDb(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      score      REAL    NOT NULL,
      summary    TEXT    NOT NULL,
      created_at TEXT    NOT NULL
    )
  `);
}

// Initialise at module load time so it's ready on first import.
initDb();

/**
 * Atomically append one scan record. SQLite serialises concurrent writes.
 */
export function appendScan(score: number, summary: string): void {
  const stmt = db.prepare(
    "INSERT INTO scans (score, summary, created_at) VALUES (?, ?, ?)"
  );
  stmt.run(score, summary, new Date().toISOString());
}

/**
 * Return all scans ordered newest-first, shaped to match the previous JSON log format.
 */
export function getAllScans(): { score: number; summary: string; createdAt: string }[] {
  const rows = db
    .prepare("SELECT score, summary, created_at FROM scans ORDER BY id DESC")
    .all() as { score: number; summary: string; created_at: string }[];

  return rows.map((r) => ({
    score: r.score,
    summary: r.summary,
    createdAt: r.created_at,
  }));
}

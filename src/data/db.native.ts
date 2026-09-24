/**
 * SQLite storage (expo-sqlite). Entities are stored as JSON with a few indexed
 * columns. Exposures older than the load window stay on disk; their exact
 * hashes are kept forever in `exact_hashes` so an old question is never re-served.
 */
import * as SQLite from 'expo-sqlite';
import type { Database, LoadedData, WriteOp } from './types';

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY NOT NULL, part TEXT, skill TEXT, difficulty INTEGER, source TEXT, status TEXT, created_at INTEGER, json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status, created_at);
CREATE TABLE IF NOT EXISTS exposures (id INTEGER PRIMARY KEY AUTOINCREMENT, question_id TEXT, at INTEGER, part TEXT, json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_exposures_at ON exposures(at);
CREATE TABLE IF NOT EXISTS exact_hashes (hash TEXT PRIMARY KEY NOT NULL);
CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY NOT NULL, session_id TEXT, question_id TEXT, skill TEXT, at INTEGER, correct INTEGER, json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_attempts_at ON attempts(at);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY NOT NULL, started_at INTEGER, ended_at INTEGER, mode TEXT, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS vocab (word TEXT PRIMARY KEY NOT NULL, mastery REAL, last_seen INTEGER, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY NOT NULL, at INTEGER, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS decisions (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, kind TEXT, message TEXT);
`;

export function createDatabase(): Database {
  let db: SQLite.SQLiteDatabase | null = null;
  const get = () => {
    if (!db) throw new Error('db not initialised');
    return db;
  };
  return {
    async init() {
      db = await SQLite.openDatabaseAsync('toeic990.db');
      await db.execAsync(SCHEMA);
    },
    async load(sinceMs: number): Promise<LoadedData> {
      const d = get();
      const kvRows = await d.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM kv');
      const kv: Record<string, unknown> = {};
      for (const r of kvRows) kv[r.key] = JSON.parse(r.value);
      const qRows = await d.getAllAsync<{ json: string; status: string }>("SELECT json, status FROM questions WHERE status = 'pool' OR created_at >= ?", sinceMs);
      const eRows = await d.getAllAsync<{ json: string }>('SELECT json FROM exposures WHERE at >= ? ORDER BY at', sinceMs);
      const hRows = await d.getAllAsync<{ hash: string }>('SELECT hash FROM exact_hashes');
      const aRows = await d.getAllAsync<{ json: string }>('SELECT json FROM attempts ORDER BY at');
      const sRows = await d.getAllAsync<{ json: string }>('SELECT json FROM sessions ORDER BY started_at');
      const vRows = await d.getAllAsync<{ json: string }>('SELECT json FROM vocab');
      const jRows = await d.getAllAsync<{ json: string }>('SELECT json FROM jobs ORDER BY at DESC LIMIT 300');
      const dRows = await d.getAllAsync<{ at: number; kind: string; message: string }>('SELECT at, kind, message FROM decisions ORDER BY id DESC LIMIT 400');
      return {
        kv,
        questions: qRows.map((r) => ({ q: JSON.parse(r.json), status: r.status as 'shown' | 'pool' })),
        exposures: eRows.map((r) => JSON.parse(r.json)),
        exactHashes: hRows.map((r) => r.hash),
        attempts: aRows.map((r) => JSON.parse(r.json)),
        sessions: sRows.map((r) => JSON.parse(r.json)),
        vocab: vRows.map((r) => JSON.parse(r.json)),
        jobs: jRows.map((r) => JSON.parse(r.json)).reverse(),
        decisions: dRows.reverse().map((r) => ({ at: r.at, kind: r.kind as 'plan', message: r.message })),
      };
    },
    async write(op: WriteOp) {
      const d = get();
      switch (op.t) {
        case 'kv':
          await d.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', op.key, JSON.stringify(op.value));
          break;
        case 'question':
          await d.runAsync(
            'INSERT OR REPLACE INTO questions (id, part, skill, difficulty, source, status, created_at, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            op.q.id,
            op.q.part,
            op.q.skill,
            op.q.difficulty,
            op.q.sourceType,
            op.status,
            op.q.generationTimestamp,
            JSON.stringify(op.q),
          );
          break;
        case 'poolRemove':
          await d.runAsync("UPDATE questions SET status = 'shown', created_at = ? WHERE id = ?", Date.now(), op.id);
          break;
        case 'exposure':
          await d.runAsync('INSERT INTO exposures (question_id, at, part, json) VALUES (?, ?, ?, ?)', op.r.questionId, op.r.at, op.r.part, JSON.stringify(op.r));
          await d.runAsync('INSERT OR IGNORE INTO exact_hashes (hash) VALUES (?)', op.r.exact);
          break;
        case 'attempt':
          await d.runAsync('INSERT OR REPLACE INTO attempts (id, session_id, question_id, skill, at, correct, json) VALUES (?, ?, ?, ?, ?, ?, ?)', op.a.id, op.a.sessionId, op.a.questionId, op.a.skill, op.a.at, op.a.correct ? 1 : 0, JSON.stringify(op.a));
          break;
        case 'session':
          await d.runAsync('INSERT OR REPLACE INTO sessions (id, started_at, ended_at, mode, json) VALUES (?, ?, ?, ?, ?)', op.s.id, op.s.startedAt, op.s.endedAt, op.s.mode, JSON.stringify(op.s));
          break;
        case 'vocab':
          await d.runAsync('INSERT OR REPLACE INTO vocab (word, mastery, last_seen, json) VALUES (?, ?, ?, ?)', op.v.word, op.v.mastery, op.v.lastSeen, JSON.stringify(op.v));
          break;
        case 'job':
          await d.runAsync('INSERT OR REPLACE INTO jobs (id, at, json) VALUES (?, ?, ?)', op.j.id, op.j.at, JSON.stringify(op.j));
          break;
        case 'decision':
          await d.runAsync('INSERT INTO decisions (at, kind, message) VALUES (?, ?, ?)', op.d.at, op.d.kind, op.d.message);
          break;
      }
    },
    async clear() {
      const d = get();
      await d.execAsync('DELETE FROM kv; DELETE FROM questions; DELETE FROM exposures; DELETE FROM exact_hashes; DELETE FROM attempts; DELETE FROM sessions; DELETE FROM vocab; DELETE FROM jobs; DELETE FROM decisions;');
    },
  };
}

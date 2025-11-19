// src/lib/sqlite-service.ts
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import type { Submission } from '@/lib/types';
import type { StorageService } from './storage-service.interface';

const DB_NAME = 'offline_forms_db';
const TABLE_NAME = 'submissions';

let db: SQLiteDBConnection | null = null;
let sqlite: SQLiteConnection | null = null;

const schema = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
    id TEXT PRIMARY KEY NOT NULL,
    formData TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    nextAttemptAt INTEGER
  );
`;

async function init(): Promise<void> {
  // This check is important to avoid re-initializing on hot reloads
  if (db) return;

  try {
    sqlite = new SQLiteConnection(CapacitorSQLite);
    const ret = await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

    if (ret.result && isConn) {
      db = await sqlite.retrieveConnection(DB_NAME, false);
    } else {
      db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    }

    await db.open();
    await db.execute(schema);
    // Keep connection open for native
  } catch (e) {
    console.error('Error initializing SQLite database:', e);
    // If init fails, subsequent calls will throw "Database not initialized."
    // This is better than crashing the app.
    db = null;
    throw e;
  }
}

async function getSubmissions(): Promise<Submission[]> {
  if (!db) throw new Error('Database not initialized.');
  const res = await db.query(`SELECT * FROM ${TABLE_NAME} ORDER BY timestamp DESC;`);
  return (res.values || []).map(row => ({
    ...row,
    formData: JSON.parse(row.formData),
  }));
}

async function addOrUpdateSubmission(submission: Submission): Promise<void> {
  if (!db) throw new Error('Database not initialized.');
  const { id, formData, status, attempts, timestamp, nextAttemptAt } = submission;
  const query = `
    INSERT OR REPLACE INTO ${TABLE_NAME} (id, formData, status, attempts, timestamp, nextAttemptAt)
    VALUES (?, ?, ?, ?, ?, ?);
  `;
  const values = [
    id,
    JSON.stringify(formData),
    status,
    attempts,
    timestamp,
    nextAttemptAt ?? null
  ];

  await db.run(query, values);
}

async function deleteSubmission(id: string): Promise<void> {
  if (!db) throw new Error('Database not initialized.');
  await db.run(`DELETE FROM ${TABLE_NAME} WHERE id = ?;`, [id]);
}

export { init, getSubmissions, addOrUpdateSubmission, deleteSubmission };

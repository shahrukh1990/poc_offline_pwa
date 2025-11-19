// src/lib/sqlite-service.ts
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import type { Submission } from '@/lib/types';

const DB_NAME = 'offline_forms_db';
const TABLE_NAME = 'submissions';

export let db: SQLiteDBConnection | null = null;
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

export async function initDb() {
  if (db) return; // Already initialized

  const platform = Capacitor.getPlatform();
  
  try {
    if (platform === 'web') {
      const sqlitePlugin = CapacitorSQLite;
      await sqlitePlugin.initWebStore();
    }
    
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
    await db.close(); // Close after schema setup, will be reopened for operations
  } catch (e) {
    console.error('Error initializing SQLite database:', e);
    throw e;
  }
}

async function performDbOperation<T>(operation: (db: SQLiteDBConnection) => Promise<T>): Promise<T> {
  if (!sqlite || !db) throw new Error('Database not initialized.');
  try {
    await db.open();
    return await operation(db);
  } catch (e) {
    console.error('Database operation failed:', e);
    throw e;
  } finally {
    if (db && await db.isOpen()) {
       await db.close();
    }
  }
}

export async function getSubmissions(): Promise<Submission[]> {
  return performDbOperation(async (db) => {
    const res = await db.query(`SELECT * FROM ${TABLE_NAME} ORDER BY timestamp DESC;`);
    return (res.values || []).map(row => ({
      ...row,
      formData: JSON.parse(row.formData),
    }));
  });
}

export async function addOrUpdateSubmission(submission: Submission): Promise<void> {
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

  await performDbOperation(db => db.run(query, values));
}

export async function deleteSubmission(id: string): Promise<void> {
  await performDbOperation(db => db.run(`DELETE FROM ${TABLE_NAME} WHERE id = ?;`, [id]));
}

// src/lib/storage-service.ts
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
const QUEUE_STORAGE_KEY = 'submissionQueue';

let db: SQLiteDBConnection | null = null;
let sqlite: SQLiteConnection | null = null;
let localStorageSubmissions: Submission[] = [];

const isNative = Capacitor.isNativePlatform();

const sqliteSchema = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
    id TEXT PRIMARY KEY NOT NULL,
    formData TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    nextAttemptAt INTEGER
  );
`;

async function initNative(): Promise<void> {
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
    await db.execute(sqliteSchema);
  } catch (e) {
    console.error('Error initializing SQLite database:', e);
    db = null;
    throw e;
  }
}

function initWeb(): Promise<void> {
  try {
    const storedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (storedQueue) {
      localStorageSubmissions = JSON.parse(storedQueue);
    }
  } catch (error) {
    console.error('Failed to load submission queue from localStorage:', error);
    localStorageSubmissions = [];
  }
  return Promise.resolve();
}

async function getNativeSubmissions(): Promise<Submission[]> {
  if (!db) throw new Error('Database not initialized.');
  const res = await db.query(`SELECT * FROM ${TABLE_NAME} ORDER BY timestamp DESC;`);
  return (res.values || []).map(row => ({
    ...row,
    formData: JSON.parse(row.formData),
  }));
}

function getWebSubmissions(): Promise<Submission[]> {
  return Promise.resolve(localStorageSubmissions);
}

async function addOrUpdateNativeSubmission(submission: Submission): Promise<void> {
  if (!db) throw new Error('Database not initialized.');
  const { id, formData, status, attempts, timestamp, nextAttemptAt } = submission;
  const query = `
    INSERT OR REPLACE INTO ${TABLE_NAME} (id, formData, status, attempts, timestamp, nextAttemptAt)
    VALUES (?, ?, ?, ?, ?, ?);
  `;
  const values = [id, JSON.stringify(formData), status, attempts, timestamp, nextAttemptAt ?? null];
  await db.run(query, values);
}

function persistWeb() {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(localStorageSubmissions));
  } catch (error) {
    console.error('Failed to save submission queue to localStorage:', error);
  }
}

function addOrUpdateWebSubmission(submission: Submission): Promise<void> {
  const index = localStorageSubmissions.findIndex(s => s.id === submission.id);
  if (index > -1) {
    localStorageSubmissions[index] = submission;
  } else {
    localStorageSubmissions.unshift(submission);
  }
  persistWeb();
  return Promise.resolve();
}

async function deleteNativeSubmission(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized.');
    await db.run(`DELETE FROM ${TABLE_NAME} WHERE id = ?;`, [id]);
}

function deleteWebSubmission(id: string): Promise<void> {
    localStorageSubmissions = localStorageSubmissions.filter(s => s.id !== id);
    persistWeb();
    return Promise.resolve();
}

export const init: StorageService['init'] = isNative ? initNative : initWeb;
export const getSubmissions: StorageService['getSubmissions'] = isNative ? getNativeSubmissions : getWebSubmissions;
export const addOrUpdateSubmission: StorageService['addOrUpdateSubmission'] = isNative ? addOrUpdateNativeSubmission : addOrUpdateWebSubmission;
export const deleteSubmission: StorageService['deleteSubmission'] = isNative ? deleteNativeSubmission : deleteWebSubmission;

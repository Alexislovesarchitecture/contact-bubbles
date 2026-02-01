import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { schemaSql } from './schema.js';

export type DB = Database.Database;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(projectRoot, 'data');
const dbPath = path.resolve(dataDir, 'contacts.sqlite');

export function normalizePhone(phone: string): string {
  return phone.replace(/\D+/g, '');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function openDb(): DB {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.exec(schemaSql);
  return db;
}

export function getDbPath(): string {
  return dbPath;
}

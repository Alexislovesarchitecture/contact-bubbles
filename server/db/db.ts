import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { schemaSql } from './schema.js';

export type DB = Database.Database;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultDataDir = path.resolve(projectRoot, 'data');
const defaultDbPath = path.resolve(defaultDataDir, 'contacts.sqlite');

function resolveDbPath(): string {
  const envPath = process.env.CONTACTS_DB_PATH?.trim();
  if (envPath) {
    return envPath === ':memory:' ? ':memory:' : path.resolve(envPath);
  }
  return defaultDbPath;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D+/g, '');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function openDb(): DB {
  const dbPath = resolveDbPath();
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.exec(schemaSql);
  return db;
}

export function getDbPath(): string {
  return resolveDbPath();
}

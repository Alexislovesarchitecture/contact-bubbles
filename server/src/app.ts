import express from 'express';
import cors from 'cors';
import { openDb } from '../db/db.js';
import { createApiRouter } from './api.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  const db = openDb();
  app.use('/api', createApiRouter(db));

  return { app, db };
}

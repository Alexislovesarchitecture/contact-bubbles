import { Router } from 'express';
import crypto from 'node:crypto';
import type { DB } from '../db/db.js';
import { normalizePhone, nowIso } from '../db/db.js';

function id(): string {
  return crypto.randomUUID();
}

function ok<T>(res: any, data: T) {
  res.json(data);
}

function bad(res: any, message: string, status = 400) {
  res.status(status).json({ error: message });
}

export function createApiRouter(db: DB): Router {
  const r = Router();

  // Contacts
  r.get('/contacts', (req, res) => {
    const q = String(req.query.query || '').trim().toLowerCase();

    // basic search over name/email/phone
    // Keep it simple: fetch contacts and left join possible matching values.
    const rows = db
      .prepare(
        `SELECT c.id, c.display_name, c.note, c.created_at, c.updated_at
         FROM contacts c
         WHERE (
           ? = ''
           OR lower(c.display_name) LIKE '%' || ? || '%'
           OR EXISTS (SELECT 1 FROM contact_emails e WHERE e.contact_id = c.id AND lower(e.email) LIKE '%' || ? || '%')
           OR EXISTS (SELECT 1 FROM contact_phones p WHERE p.contact_id = c.id AND (p.phone_normalized LIKE '%' || ? || '%' OR p.phone LIKE '%' || ? || '%'))
         )
         ORDER BY c.display_name COLLATE NOCASE ASC`
      )
      .all(q, q, q, q.replace(/\D+/g, ''), q);

    ok(res, { contacts: rows.map(mapContactRowBasic) });
  });

  r.post('/contacts', (req, res) => {
    const displayName = String(req.body?.displayName || '').trim();
    const note = req.body?.note != null ? String(req.body.note) : null;
    const phones = Array.isArray(req.body?.phones) ? req.body.phones : [];
    const emails = Array.isArray(req.body?.emails) ? req.body.emails : [];

    if (!displayName) return bad(res, 'displayName is required');

    const contactId = id();
    const now = nowIso();

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO contacts (id, display_name, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(contactId, displayName, note, now, now);

      for (const p of phones) {
        const phone = String(p?.phone || '').trim();
        if (!phone) continue;
        db.prepare(
          `INSERT INTO contact_phones (id, contact_id, label, phone, phone_normalized)
           VALUES (?, ?, ?, ?, ?)`
        ).run(id(), contactId, p?.label != null ? String(p.label) : null, phone, normalizePhone(phone));
      }

      for (const e of emails) {
        const email = String(e?.email || '').trim();
        if (!email) continue;
        db.prepare(
          `INSERT INTO contact_emails (id, contact_id, label, email)
           VALUES (?, ?, ?, ?)`
        ).run(id(), contactId, e?.label != null ? String(e.label) : null, email);
      }
    });

    tx();
    const contact = getContact(db, contactId);
    ok(res, contact);
  });

  r.get('/contacts/:id', (req, res) => {
    const contact = getContact(db, req.params.id);
    if (!contact) return bad(res, 'Not found', 404);
    ok(res, contact);
  });

  r.put('/contacts/:id', (req, res) => {
    const contactId = req.params.id;
    const existing = getContact(db, contactId);
    if (!existing) return bad(res, 'Not found', 404);

    const displayName = String(req.body?.displayName || '').trim();
    const note = req.body?.note != null ? String(req.body.note) : null;
    const phones = Array.isArray(req.body?.phones) ? req.body.phones : [];
    const emails = Array.isArray(req.body?.emails) ? req.body.emails : [];

    if (!displayName) return bad(res, 'displayName is required');

    const now = nowIso();

    const tx = db.transaction(() => {
      db.prepare(`UPDATE contacts SET display_name=?, note=?, updated_at=? WHERE id=?`).run(
        displayName,
        note,
        now,
        contactId
      );

      // Simplest: delete and re-insert phones/emails
      db.prepare(`DELETE FROM contact_phones WHERE contact_id=?`).run(contactId);
      db.prepare(`DELETE FROM contact_emails WHERE contact_id=?`).run(contactId);

      for (const p of phones) {
        const phone = String(p?.phone || '').trim();
        if (!phone) continue;
        db.prepare(
          `INSERT INTO contact_phones (id, contact_id, label, phone, phone_normalized)
           VALUES (?, ?, ?, ?, ?)`
        ).run(id(), contactId, p?.label != null ? String(p.label) : null, phone, normalizePhone(phone));
      }

      for (const e of emails) {
        const email = String(e?.email || '').trim();
        if (!email) continue;
        db.prepare(
          `INSERT INTO contact_emails (id, contact_id, label, email)
           VALUES (?, ?, ?, ?)`
        ).run(id(), contactId, e?.label != null ? String(e.label) : null, email);
      }
    });

    tx();
    const contact = getContact(db, contactId);
    ok(res, contact);
  });

  r.delete('/contacts/:id', (req, res) => {
    const contactId = req.params.id;
    const existing = db.prepare(`SELECT id FROM contacts WHERE id=?`).get(contactId);
    if (!existing) return bad(res, 'Not found', 404);

    db.prepare(`DELETE FROM contacts WHERE id=?`).run(contactId);
    ok(res, { ok: true });
  });

  // Relationships
  r.get('/contacts/:id/relationships', (req, res) => {
    const contactId = req.params.id;
    const rels = db
      .prepare(
        `SELECT r.*, 
                c1.display_name AS from_display_name,
                c2.display_name AS to_display_name
         FROM relationships r
         JOIN contacts c1 ON c1.id = r.from_contact_id
         JOIN contacts c2 ON c2.id = r.to_contact_id
         WHERE r.from_contact_id = ? OR r.to_contact_id = ?
         ORDER BY r.updated_at DESC`
      )
      .all(contactId, contactId);

    ok(res, { relationships: rels.map(mapRelRow) });
  });

  r.post('/relationships', (req, res) => {
    const fromContactId = String(req.body?.fromContactId || '').trim();
    const toContactId = String(req.body?.toContactId || '').trim();
    const type = String(req.body?.type || '').trim() || 'custom';
    const directed = Number(req.body?.directed ? 1 : 0) as 0 | 1;
    const strengthRaw = req.body?.strength;
    const strength = strengthRaw == null || strengthRaw === '' ? null : Number(strengthRaw);
    const note = req.body?.note != null ? String(req.body.note) : null;

    if (!fromContactId || !toContactId) return bad(res, 'fromContactId and toContactId are required');
    if (fromContactId === toContactId) return bad(res, 'cannot link contact to itself');
    if (strength != null && (Number.isNaN(strength) || strength < 1 || strength > 5)) {
      return bad(res, 'strength must be 1-5');
    }

    const now = nowIso();
    const relId = id();

    db.prepare(
      `INSERT INTO relationships (id, from_contact_id, to_contact_id, type, directed, strength, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(relId, fromContactId, toContactId, type, directed, strength, note, now, now);

    const row = db
      .prepare(
        `SELECT r.*,
                c1.display_name AS from_display_name,
                c2.display_name AS to_display_name
         FROM relationships r
         JOIN contacts c1 ON c1.id = r.from_contact_id
         JOIN contacts c2 ON c2.id = r.to_contact_id
         WHERE r.id = ?`
      )
      .get(relId);
    ok(res, mapRelRow(row));
  });

  r.delete('/relationships/:id', (req, res) => {
    const relId = req.params.id;
    const existing = db.prepare(`SELECT id FROM relationships WHERE id=?`).get(relId);
    if (!existing) return bad(res, 'Not found', 404);
    db.prepare(`DELETE FROM relationships WHERE id=?`).run(relId);
    ok(res, { ok: true });
  });

  // Local graph
  r.get('/graph/local', (req, res) => {
    const contactId = String(req.query.contactId || '').trim();
    const depth = Math.max(1, Math.min(3, Number(req.query.depth || 1)));
    const typesParam = String(req.query.types || '').trim();
    const allowedTypes = typesParam ? new Set(typesParam.split(',').map((s) => s.trim()).filter(Boolean)) : null;

    if (!contactId) return bad(res, 'contactId is required');

    const nodes = new Map<string, { id: string; displayName: string }>();
    const edges: Array<{ id: string; from: string; to: string; type: string; directed: 0 | 1; strength: number | null }> = [];
    const edgeIds = new Set<string>();

    const getDisplayName = db.prepare(`SELECT id, display_name FROM contacts WHERE id=?`);
    const relStmt = db.prepare(
      `SELECT id, from_contact_id, to_contact_id, type, directed, strength
       FROM relationships
       WHERE (from_contact_id = ? OR to_contact_id = ?)
       ${allowedTypes ? 'AND type IN (' + Array.from(allowedTypes).map(() => '?').join(',') + ')' : ''}`
    );

    const start = getDisplayName.get(contactId);
    if (!start) return bad(res, 'Not found', 404);

    nodes.set(start.id, { id: start.id, displayName: start.display_name });

    const frontier = [{ id: contactId, d: 0 }];
    const seen = new Set<string>([contactId]);

    while (frontier.length) {
      const cur = frontier.shift()!;
      if (cur.d >= depth) continue;

      const params: any[] = [cur.id, cur.id];
      if (allowedTypes) params.push(...Array.from(allowedTypes));

      const rels = relStmt.all(...params);
      for (const r0 of rels) {
        if (allowedTypes && !allowedTypes.has(String(r0.type))) continue;
        const from = String(r0.from_contact_id);
        const to = String(r0.to_contact_id);
        const edgeId = String(r0.id);
        if (!edgeIds.has(edgeId)) {
          edgeIds.add(edgeId);
          edges.push({
            id: edgeId,
            from,
            to,
            type: String(r0.type),
            directed: Number(r0.directed) as 0 | 1,
            strength: r0.strength == null ? null : Number(r0.strength)
          });
        }

        for (const otherId of [from, to]) {
          if (!nodes.has(otherId)) {
            const row = getDisplayName.get(otherId);
            if (row) nodes.set(otherId, { id: row.id, displayName: row.display_name });
          }
          if (!seen.has(otherId)) {
            seen.add(otherId);
            frontier.push({ id: otherId, d: cur.d + 1 });
          }
        }
      }
    }

    ok(res, { nodes: Array.from(nodes.values()), edges });
  });

  return r;
}

function mapContactRowBasic(row: any) {
  return {
    id: row.id,
    displayName: row.display_name,
    note: row.note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getContact(db: DB, contactId: string) {
  const c = db.prepare(`SELECT * FROM contacts WHERE id=?`).get(contactId);
  if (!c) return null;
  const phones = db
    .prepare(`SELECT id, label, phone FROM contact_phones WHERE contact_id=? ORDER BY phone ASC`)
    .all(contactId);
  const emails = db
    .prepare(`SELECT id, label, email FROM contact_emails WHERE contact_id=? ORDER BY email ASC`)
    .all(contactId);
  return {
    id: c.id,
    displayName: c.display_name,
    note: c.note ?? null,
    phones: phones.map((p: any) => ({ id: p.id, label: p.label ?? null, phone: p.phone })),
    emails: emails.map((e: any) => ({ id: e.id, label: e.label ?? null, email: e.email })),
    createdAt: c.created_at,
    updatedAt: c.updated_at
  };
}

function mapRelRow(row: any) {
  return {
    id: row.id,
    fromContactId: row.from_contact_id,
    toContactId: row.to_contact_id,
    type: row.type,
    directed: Number(row.directed) as 0 | 1,
    strength: row.strength == null ? null : Number(row.strength),
    note: row.note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fromDisplayName: row.from_display_name,
    toDisplayName: row.to_display_name
  };
}

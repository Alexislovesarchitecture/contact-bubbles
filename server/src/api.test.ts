import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.ts';

test('GET /api/health', async () => {
  const { app } = createApp();
  const server = app.listen(0);
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
  } finally {
    server.close();
  }
});

test('contacts CRUD minimal', async () => {
  const { app } = createApp();
  const server = app.listen(0);
  const port = (server.address() as any).port;

  async function j(method: string, path: string, body?: any) {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const txt = await res.text();
    return { status: res.status, json: txt ? JSON.parse(txt) : null };
  }

  try {
    const created = await j('POST', '/api/contacts', { displayName: 'Ada Lovelace', note: 'test' });
    assert.equal(created.status, 200);
    assert.ok(created.json.id);

    const id = created.json.id;

    const list = await j('GET', '/api/contacts?query=ada');
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.json.contacts));
    assert.ok(list.json.contacts.some((c: any) => c.id === id));

    const got = await j('GET', `/api/contacts/${id}`);
    assert.equal(got.status, 200);
    assert.equal(got.json.displayName, 'Ada Lovelace');

    const upd = await j('PUT', `/api/contacts/${id}`, { displayName: 'Ada L.', note: null, phones: [], emails: [] });
    assert.equal(upd.status, 200);
    assert.equal(upd.json.displayName, 'Ada L.');

    const del = await j('DELETE', `/api/contacts/${id}`);
    assert.equal(del.status, 200);
    assert.equal(del.json.ok, true);
  } finally {
    server.close();
  }
});

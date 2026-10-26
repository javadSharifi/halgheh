// Usage: node scripts/smoke-sync.mjs <worker-url>
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const [url] = process.argv.slice(2);
const key = () => randomBytes(16).toString('base64url');
const post = async (path, k, body) => {
  const r = await fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(k && { authorization: `Bearer ${k}` }) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
const row = (id, updatedAt, extra = {}) => ({ t: 'tasks', id, updatedAt, data: JSON.stringify({ id, title: 't', updatedAt, ...extra }) });

const a = key(), b = key();
assert.equal((await post('/api/sync', null, { since: 0, changes: [] })).status, 401, 'no key');
assert.equal((await post('/api/sync', a, { since: 0, changes: [] })).status, 401, 'unregistered key');
assert.equal((await post('/api/register', a, { mode: 'login' })).status, 401, 'login without an account');
assert.equal((await post('/api/register', a, { mode: 'register' })).status, 200, 'create account');
assert.equal((await post('/api/register', a, { mode: 'register' })).status, 409, 'duplicate account');
assert.equal((await post('/api/register', a, { mode: 'login' })).status, 200, 'login to existing account');

let r = await post('/api/sync', a, { since: 0, changes: [row('x', 100)] });
assert.equal(r.status, 200);
const clock1 = r.body.clock;
r = await post('/api/sync', a, { since: 0, changes: [] });
assert.equal(r.body.changes.length, 1, 'device 2 pulls the row');

await post('/api/sync', a, { since: clock1, changes: [row('x', 50, { title: 'older' })] });
r = await post('/api/sync', a, { since: 0, changes: [] });
assert.equal(JSON.parse(r.body.changes[0].data).title, 't', 'older write does not win');

await post('/api/sync', a, { since: 0, changes: [row('x', 200, { title: 'newer' })] });
r = await post('/api/sync', a, { since: 0, changes: [] });
assert.equal(JSON.parse(r.body.changes[0].data).title, 'newer', 'newer write wins');

const clock2 = r.body.clock;
await post('/api/sync', a, { since: clock2, changes: [{ t: 'tasks', id: 'x', updatedAt: 300, deleted: 1 }] });
r = await post('/api/sync', a, { since: clock2, changes: [] });
assert.deepEqual(r.body.changes.map((c) => [c.id, c.deleted]), [['x', 1]], 'delete syncs as a tombstone');
r = await post('/api/sync', a, { since: r.body.clock, changes: [] });
assert.equal(r.body.changes.length, 0, 'nothing new after the last clock');

assert.equal((await post('/api/sync', a, { since: 0, changes: [{ ...row('y', 1), t: 'accounts' }] })).status, 400, 'table allowlist');
assert.equal((await post('/api/sync', a, { since: 0, changes: Array.from({ length: 201 }, (_, i) => row('r' + i, 1)) })).status, 400, 'too many changes');

assert.equal((await post('/api/register', b, { mode: 'register' })).status, 200);
r = await post('/api/sync', b, { since: 0, changes: [] });
assert.equal(r.body.changes.length, 0, 'accounts are isolated');
console.log('sync smoke test: all checks passed');

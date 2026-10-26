import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { tickMedication } from '../src/medication.js';
import { tickClinical } from '../src/clinical.js';

// Endpoints and behaviour added when the web app (An Tâm v1.0) was connected to this API.
const PASSWORD = 'AnTam-test-password-2026!';
const KEYS = { jwtSecret: 'integration-test-secret-which-is-at-least-thirty-two-characters', tokenEncryptionKey: '34'.repeat(32), logErrors: false };

async function fixture(t, { initialTime = '2026-10-22T00:10:00.000Z', config = {}, realClock = false } = {}) {
  let currentTime = new Date(initialTime);
  const dir = await mkdtemp(path.join(tmpdir(), 'antam-v1-test-'));
  const runtime = await createApp({
    databasePath: ':memory:',
    ...(realClock ? {} : { now: () => new Date(currentTime) }),
    config: { ...KEYS, reportDir: path.join(dir, 'reports'), dataDir: dir, frontendDir: path.join(dir, 'missing'), ...config },
  });
  const server = await new Promise((resolve) => {
    const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  runtime.ctx.config.baseUrl = base;
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    runtime.close();
    await rm(dir, { recursive: true, force: true });
  });
  const req = async (method, endpoint, token, body, headers = {}) => {
    const url = endpoint.startsWith('/api/') || endpoint.startsWith('/health') || endpoint === '/' ? `${base}${endpoint}` : `${base}/api/v1${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, type: response.headers.get('content-type') || '', body: response.headers.get('content-type')?.includes('json') && text ? JSON.parse(text) : text };
  };
  const ok = async (method, endpoint, token, body, status = 200) => {
    const res = await req(method, endpoint, token, body);
    assert.equal(res.status, status, `${method} ${endpoint}: ${JSON.stringify(res.body).slice(0, 400)}`);
    return res.body;
  };
  const owner = async (displayName = 'owner') => {
    const account = { email: `user${Math.random().toString(36).slice(2, 8)}@example.test`, password: PASSWORD, displayName };
    account.id = (await ok('POST', '/auth/register', undefined, account, 201)).id;
    account.token = (await ok('POST', '/auth/login', undefined, { email: account.email, password: PASSWORD })).accessToken;
    return account;
  };
  const pair = async (user, patientId, role = 'PATIENT', delegateId) => {
    const { code } = await ok('POST', `/patients/${patientId}/pairing-codes`, user.token, { role, ...(delegateId ? { delegateId } : {}) }, 201);
    return ok('POST', '/devices/pair', undefined, { code, pushToken: 'push', platform: 'ANDROID', deviceName: 'Máy thử' });
  };
  const time = (value) => { currentTime = new Date(value); };
  return { ...runtime, base, req, ok, owner, pair, time, dir };
}

const prescription = (overrides = {}) => ({
  issuedDate: '2026-10-22', startDate: '2026-10-22', nextVisitDate: '2026-10-24',
  items: [{ drugId: '10000000-0000-4000-8000-000000000001', drugNameRaw: 'Glucophage 500mg', unitsPerDose: 1, unit: 'viên', slots: ['MORNING', 'EVENING'] }],
  ...overrides,
});

test('same-origin browser requests pass CORS; foreign origins are still rejected', async (t) => {
  const f = await fixture(t);
  const sameOrigin = await f.req('POST', '/auth/register', undefined, { email: 'a@example.test', password: PASSWORD, displayName: 'A' }, { origin: f.base });
  assert.equal(sameOrigin.status, 201);
  const foreign = await f.req('POST', '/auth/login', undefined, { email: 'a@example.test', password: PASSWORD }, { origin: 'http://evil.example' });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.body.code, 'ORIGIN_NOT_ALLOWED');
});

test('built web app is served on the same port; unknown API paths stay JSON 404', async (t) => {
  const web = await mkdtemp(path.join(tmpdir(), 'antam-v1-web-'));
  t.after(() => rm(web, { recursive: true, force: true }));
  await writeFile(path.join(web, 'index.html'), '<!doctype html><title>An Tâm</title>');
  const f = await fixture(t, { config: { frontendDir: web } });
  const page = await f.req('GET', '/');
  assert.equal(page.status, 200);
  assert.match(page.type, /text\/html/);
  assert.match(page.body, /An Tâm/);
  const missing = await f.req('GET', '/api/v1/khong-ton-tai');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, 'NOT_FOUND');
});

test('drug lookup by id, prescription timestamps and supersededBy link', async (t) => {
  const f = await fixture(t);
  const user = await f.owner();
  const drug = await f.ok('GET', '/drugs/6f1c2a10-0010-4a01-9a01-000000000010', user.token);
  assert.equal(drug.brandName, 'Januvia 50mg');
  assert.equal((await f.req('GET', '/drugs/6f1c2a10-9999-4a01-9a01-000000009999', user.token)).status, 404);
  assert.ok((await f.ok('GET', '/drugs?q=januvia', user.token)).length >= 2, 'web app catalogue entries are searchable');

  const patient = await f.ok('POST', '/patients', user.token, { alias: 'Bố', birthYear: 1954 }, 201);
  const first = await f.ok('POST', `/patients/${patient.id}/prescriptions`, user.token, prescription(), 201);
  assert.ok(first.createdAt);
  await f.ok('POST', `/prescriptions/${first.id}/confirm`, user.token, undefined, 202);
  const second = await f.ok('POST', `/patients/${patient.id}/prescriptions`, user.token, prescription(), 201);
  await f.ok('POST', `/prescriptions/${second.id}/confirm`, user.token, undefined, 202);
  const old = await f.ok('GET', `/prescriptions/${first.id}`, user.token);
  assert.equal(old.status, 'SUPERSEDED');
  assert.equal(old.supersededBy, second.id);
  assert.ok(old.updatedAt >= old.createdAt);
});

test('device profile, labelled confirmations, correction history and last confirmed dose', async (t) => {
  const f = await fixture(t);
  const user = await f.owner();
  const patient = await f.ok('POST', '/patients', user.token, { alias: 'Bố', birthYear: 1954 }, 201);
  const delegate = await f.ok('POST', `/patients/${patient.id}/delegates`, user.token, { alias: 'Mẹ', relation: 'Vợ' }, 201);
  const phone = await f.pair(user, patient.id);
  const helper = await f.pair(user, patient.id, 'DELEGATE', delegate.id);
  assert.equal(helper.ownerAlias, 'Mẹ');
  const me = await f.ok('GET', '/device/me', helper.deviceToken);
  assert.deepEqual([me.role, me.patientAlias, me.ownerAlias, me.deviceName], ['DELEGATE', 'Bố', 'Mẹ', 'Máy thử']);

  const draft = await f.ok('POST', `/patients/${patient.id}/prescriptions`, user.token, prescription(), 201);
  await f.ok('POST', `/prescriptions/${draft.id}/confirm`, user.token, undefined, 202);
  assert.equal(await f.ok('GET', '/device/doses/last-confirmed', phone.deviceToken), null);
  const [morning] = await f.ok('GET', '/device/doses/today', phone.deviceToken);
  const original = await f.ok('POST', `/doses/${morning.id}/confirmations`, phone.deviceToken, { takenAt: '2026-10-22T00:08:00.000Z' }, 201);
  assert.equal('actorLabel' in original, false, 'POST response keeps the stored record shape');
  await f.ok('POST', `/doses/${morning.id}/confirmations`, phone.deviceToken, { takenAt: '2026-10-22T00:05:00.000Z', correctsConfirmationId: original.id }, 201);

  const chain = await f.ok('GET', `/doses/${morning.id}/confirmations`, user.token);
  assert.equal(chain.length, 2);
  assert.equal(chain[0].correctsConfirmationId, null);
  assert.equal(chain[1].correctsConfirmationId, original.id);
  assert.ok(chain.every((c) => c.actorLabel === 'Bố'));
  assert.equal((await f.req('GET', `/doses/${morning.id}/confirmations`, phone.deviceToken)).status, 401, 'history is for the caregiver');

  const listed = await f.ok('GET', `/patients/${patient.id}/doses?from=2026-10-22&to=2026-10-22`, user.token);
  assert.equal(listed.find((d) => d.id === morning.id).lastConfirmation.actorLabel, 'Bố');
  const last = await f.ok('GET', '/device/doses/last-confirmed', helper.deviceToken);
  assert.deepEqual([last.date, last.slot, last.takenAt, last.actorLabel, last.drugs], ['2026-10-22', 'MORNING', '2026-10-22T00:05:00.000Z', 'Bố', ['Glucophage 500mg']]);

  await f.ok('DELETE', `/patients/${patient.id}/devices/${me.deviceId}`, user.token, undefined, 204);
  assert.equal((await f.req('GET', '/device/me', helper.deviceToken)).status, 401);
});

test('bulk alert read, report list with date range, readable missed-dose message', async (t) => {
  const f = await fixture(t, { initialTime: '2026-10-22T00:10:00.000Z' });
  const user = await f.owner();
  const patient = await f.ok('POST', '/patients', user.token, { alias: 'Bố', birthYear: 1954 }, 201);
  const draft = await f.ok('POST', `/patients/${patient.id}/prescriptions`, user.token, prescription(), 201);
  await f.ok('POST', `/prescriptions/${draft.id}/confirm`, user.token, undefined, 202);
  f.time('2026-10-22T14:30:00.000Z');
  tickMedication(f.ctx);
  user.token = (await f.ok('POST', '/auth/login', undefined, { email: user.email, password: PASSWORD })).accessToken;
  const alerts = await f.ok('GET', `/patients/${patient.id}/alerts?unreadOnly=true`, user.token);
  assert.equal(alerts.length, 2);
  assert.equal(alerts.find((a) => a.message.includes('sáng')).message, 'Bố: chưa có xác nhận cữ sáng 07:00 ngày 22/10 (Glucophage 500mg)');

  assert.deepEqual(await f.ok('POST', `/patients/${patient.id}/alerts/read`, user.token, { alertIds: [alerts[0].id] }), { updated: 1 });
  assert.deepEqual(await f.ok('POST', `/patients/${patient.id}/alerts/read`, user.token, {}), { updated: 1 });
  assert.deepEqual(await f.ok('POST', `/patients/${patient.id}/alerts/read`, user.token, {}), { updated: 0 }, 'idempotent');
  assert.equal((await f.ok('GET', `/patients/${patient.id}/alerts?unreadOnly=true`, user.token)).length, 0);

  const report = await f.ok('POST', `/patients/${patient.id}/reports`, user.token, { periodDays: 30 }, 202);
  assert.deepEqual([report.fromDate, report.toDate], ['2026-09-23', '2026-10-22']);
  const [listed] = await f.ok('GET', `/patients/${patient.id}/reports`, user.token);
  assert.equal(listed.id, report.id);
  await tickClinical(f.ctx);
  const ready = await f.ok('GET', `/reports/${report.id}`, user.token);
  assert.ok(['READY', 'FAILED'].includes(ready.status));
});

test('audit log filters and resolved actor labels', async (t) => {
  const f = await fixture(t);
  const user = await f.owner('Bình');
  const patient = await f.ok('POST', '/patients', user.token, { alias: 'Bố', birthYear: 1954 }, 201);
  const phone = await f.pair(user, patient.id);
  const draft = await f.ok('POST', `/patients/${patient.id}/prescriptions`, user.token, prescription(), 201);
  await f.ok('POST', `/prescriptions/${draft.id}/confirm`, user.token, undefined, 202);
  const [dose] = await f.ok('GET', '/device/doses/today', phone.deviceToken);
  await f.ok('POST', `/doses/${dose.id}/confirmations`, phone.deviceToken, {}, 201);
  await f.req('POST', `/doses/${dose.id}/confirmations`, phone.deviceToken, {});

  const all = await f.ok('GET', `/patients/${patient.id}/audit-logs?size=100`, user.token);
  const byRole = (role) => all.items.filter((log) => log.actorRole === role);
  assert.ok(byRole('CAREGIVER').every((log) => log.actorLabel === 'Bình'));
  assert.ok(byRole('PATIENT').every((log) => log.actorLabel === 'Bố'));
  assert.ok(byRole('SYSTEM').length > 0);

  const failed = await f.ok('GET', `/patients/${patient.id}/audit-logs?status=FAILURE&actorRole=PATIENT`, user.token);
  assert.equal(failed.total, 1);
  assert.equal(failed.items[0].detail, 'DOSE_ALREADY_CONFIRMED');
  const search = await f.ok('GET', `/patients/${patient.id}/audit-logs?q=already&size=5`, user.token);
  assert.equal(search.total, 1);
  const confirmed = await f.ok('GET', `/patients/${patient.id}/audit-logs?actionType=DOSE_CONFIRMED`, user.token);
  assert.equal(confirmed.total, 1);
  assert.equal((await f.req('GET', `/patients/${patient.id}/audit-logs?actorRole=ROBOT`, user.token)).status, 400);
});

test('dev clock: disabled by default, forward-only when enabled, runs the scheduler', async (t) => {
  const off = await fixture(t, { realClock: true });
  const offUser = await off.owner();
  assert.equal((await off.req('GET', '/dev/clock', offUser.token)).status, 404);
  assert.equal((await off.req('GET', '/health')).body.devTools, false);

  const f = await fixture(t, { realClock: true, config: { devTools: true } });
  const user = await f.owner();
  assert.equal((await f.req('GET', '/health')).body.devTools, true);
  assert.equal((await f.req('GET', '/dev/clock')).status, 401, 'requires a signed-in caregiver');
  const before = await f.ok('GET', '/dev/clock', user.token);
  assert.equal(before.offsetMs, 0);
  const back = await f.req('POST', '/dev/clock', user.token, { to: new Date(Date.now() - 60_000).toISOString() });
  assert.equal(back.status, 422);
  assert.equal(back.body.code, 'CLOCK_BACKWARDS');
  assert.equal((await f.req('POST', '/dev/clock', user.token, { advanceMinutes: 30, to: new Date().toISOString() })).status, 400);
  const after = await f.ok('POST', '/dev/clock', user.token, { advanceMinutes: 90 });
  assert.ok(after.offsetMs >= 90 * 60_000);
  assert.ok(Date.parse(after.now) - Date.parse(before.now) >= 90 * 60_000);
});

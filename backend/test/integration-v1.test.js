import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { ensureTestAccounts } from '../src/demo-accounts.js';
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
    const tokens = await ok('POST', '/auth/login', undefined, { email: account.email, password: PASSWORD });
    account.token = tokens.accessToken;
    account.refreshToken = tokens.refreshToken;
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

test('three seeded logins share one schedule, retain history and respect delegate revocation', async t => {
  const f = await fixture(t, { config: { testAccounts: true } });
  const login = (email, role) => f.ok('POST', '/auth/login', undefined, { email, role, password: '123456' });
  const [owner, patient, delegate] = await Promise.all([
    login('nguoithan@antam.test', 'CAREGIVER'), login('benhnhan@antam.test', 'PATIENT'), login('uyquyen@antam.test', 'DELEGATE'),
  ]);
  const [profile] = await f.ok('GET', '/patients', owner.accessToken);
  assert.equal((await f.ok('GET', '/device/me', patient.accessToken)).patientId, profile.id);
  assert.equal((await f.ok('GET', '/auth/me', delegate.accessToken)).role, 'DELEGATE');
  const refreshed = await f.ok('POST', '/auth/refresh', undefined, { refreshToken: delegate.refreshToken });
  assert.equal((await f.ok('GET', '/device/me', refreshed.accessToken)).role, 'DELEGATE');
  assert.equal((await f.req('GET', '/patients', refreshed.accessToken)).status, 401);
  assert.equal((await f.req('POST', '/auth/login', undefined, { email: 'uyquyen@antam.test', role: 'PATIENT', password: '123456' })).status, 401);

  const [morning] = await f.ok('GET', '/device/doses/today', patient.accessToken);
  const action = `/doses/${morning.id}/confirmations`;
  await f.ok('POST', action, refreshed.accessToken, {}, 201);
  await ensureTestAccounts(f.ctx);
  assert.equal((await f.req('POST', action, patient.accessToken, {})).status, 409);
  const [confirmation] = await f.ok('GET', action, owner.accessToken);
  assert.equal(confirmation.actorRole, 'DELEGATE');
  assert.equal(confirmation.actorLabel, 'Mẹ (mẫu)');
  const [helper] = await f.ok('GET', `/patients/${profile.id}/delegates`, owner.accessToken);
  await f.ok('DELETE', `/patients/${profile.id}/delegates/${helper.id}`, owner.accessToken, undefined, 204);
  await ensureTestAccounts(f.ctx);
  assert.equal((await f.req('GET', '/device/me', refreshed.accessToken)).status, 401);
  assert.equal((await f.req('POST', '/auth/refresh', undefined, { refreshToken: refreshed.refreshToken })).status, 401);
  f.ctx.config.testAccounts = false;
  assert.equal((await f.req('GET', '/patients', owner.accessToken)).status, 401);
  assert.equal((await f.req('GET', '/auth/me', patient.accessToken)).status, 401);
});

test('renewal keeps historical doses and times, updates linked visits and resumes an expired schedule', async t => {
  const f = await fixture(t);
  const user = await f.owner();
  const patient = await f.ok('POST', '/patients', user.token, { alias: 'Bố', birthYear: 1954 }, 201);
  const device = await f.pair(user, patient.id);
  const root = `/patients/${patient.id}`;
  const order = await f.ok('POST', root + '/prescriptions', user.token, prescription(), 201);
  const path = `/prescriptions/${order.id}`;
  await f.ok('POST', path + '/confirm', user.token, { scheduleVisit: true }, 202);
  const before = f.ctx.db.list('doses', { prescriptionId: order.id });
  await f.ok('PATCH', root, user.token, { reminderTimes: [{ slot: 'MORNING', time: '10:00' }] });
  f.time('2026-10-27T01:00:00Z'); // 08:00 in Vietnam, after the missed visit and today's morning slot.
  const renewedLogin = await f.ok('POST', '/auth/login', undefined, { email: user.email, password: PASSWORD });
  const token = renewedLogin.accessToken;
  assert.equal((await f.ok('GET', path, token)).status, 'EXPIRED');
  const priorRows = f.ctx.db.list('doses', { prescriptionId: order.id });
  const input = { previousVisitDate: '2026-10-24', nextVisitDate: '2026-10-29' };
  assert.equal((await f.req('POST', path + '/extend', device.deviceToken, input)).status, 401);
  const other = await f.owner();
  assert.equal((await f.req('POST', path + '/extend', other.token, input)).status, 403);
  for (let i = 0; i < 2; i++) assert.equal((await f.ok('POST', path + '/extend', token, input)).status, 'ACTIVE');
  const all = f.ctx.db.list('doses', { prescriptionId: order.id });
  assert.deepEqual(all.slice(0, before.length), priorRows);
  const added = all.slice(before.length);
  assert.equal(added.length, 5);
  assert.equal(added[0].date, '2026-10-27');
  assert.equal(added[0].slot, 'EVENING');
  assert.equal(added.find(row => row.slot === 'MORNING').scheduledAt, '2026-10-28T00:00:00.000Z');
  const visits = await f.ok('GET', root + '/appointments', token);
  assert.deepEqual(visits.map(v => [v.visitDate, v.status]), [['2026-10-29', 'UPCOMING'], ['2026-10-24', 'DONE']]);
  const schedule = await f.ok('GET', '/device/doses/schedule', device.deviceToken);
  assert.deepEqual(schedule.appointments.map(v => v.id), [visits[0].id]);
  await tickClinical(f.ctx);
  assert.equal(f.ctx.db.list('alerts', { relatedAppointmentId: visits[0].id }).length, 1);
  assert.equal((await f.req('POST', path + '/extend', token, { ...input, nextVisitDate: '2026-11-01' })).status, 409);
  const next = await f.ok('POST', root + '/prescriptions', token, prescription({ nextVisitDate: '2026-10-31' }), 201);
  await f.ok('POST', `/prescriptions/${next.id}/confirm`, token, {}, 202);
  assert.equal((await f.req('POST', path + '/extend', token, { previousVisitDate: '2026-10-29', nextVisitDate: '2026-11-01' })).status, 409);
});

test('pairing codes can be regenerated after login and only replace unused codes for the same target', async t => {
  const f = await fixture(t);
  const user = await f.owner();
  const other = await f.owner();
  const patient = await f.ok('POST', '/patients', user.token, { alias: 'Bo', birthYear: 1954 }, 201);
  const root = `/patients/${patient.id}/pairing-codes`;
  const create = body => f.ok('POST', root, user.token, body || { role: 'PATIENT' }, 201);
  const pair = code => f.req('POST', '/devices/pair', undefined, { code, pushToken: 'test', platform: 'ANDROID' });
  const first = await create();
  const paired = await pair(first.code);
  assert.equal(paired.status, 200);
  const delegate = await f.ok('POST', `/patients/${patient.id}/delegates`, user.token, { alias: 'Me', relation: 'Vo' }, 201);
  const helperCode = await create({ role: 'DELEGATE', delegateId: delegate.id });
  const old = await create();
  user.token = (await f.ok('POST', '/auth/login', undefined, { email: user.email, password: PASSWORD })).accessToken;
  const fresh = await create();
  assert.notEqual(fresh.code, old.code);
  assert.equal((await pair(old.code)).status, 410);
  assert.equal((await f.ok('GET', `${root}/${old.codeId}`, user.token)).replaced, true);
  assert.equal((await f.req('GET', `${root}/${fresh.codeId}`, other.token)).status, 403);
  const status = await f.ok('GET', `${root}/${fresh.codeId}`, user.token);
  assert.equal(status.used, false);
  assert.equal(status.code, undefined);
  assert.equal(status.codeHash, undefined);
  assert.equal((await pair(helperCode.code)).status, 200);
  assert.equal((await pair(fresh.code)).status, 200);
  assert.equal((await f.ok('GET', `${root}/${fresh.codeId}`, user.token)).used, true);
  const devices = await f.ok('GET', `/patients/${patient.id}/devices`, user.token);
  assert.equal(devices.filter(d => d.pairingCodeId === fresh.codeId).length, 1);
  assert.equal((await f.req('GET', '/device/me', paired.body.deviceToken)).status, 200);
  // A used code or an expired code does not prevent generating another one.
  const expiring = await create();
  f.time('2026-10-22T00:16:00Z');
  assert.equal((await pair(expiring.code)).status, 410);
  assert.equal((await pair((await create()).code)).status, 200);
});

test('owner can edit name, birth year and reminders without rewriting existing dose history', async t => {
  const f = await fixture(t);
  const user = await f.owner();
  const other = await f.owner();
  const patient = await f.ok('POST', '/patients', user.token, { alias: 'Bo', birthYear: 1954 }, 201);
  const device = await f.pair(user, patient.id);
  const rx = await f.ok('POST', `/patients/${patient.id}/prescriptions`, user.token, prescription(), 201);
  await f.ok('POST', `/prescriptions/${rx.id}/confirm`, user.token, {}, 202);
  const before = f.ctx.db.list('doses', { prescriptionId: rx.id });
  const patch = { alias: 'Ba', birthYear: 1956, reminderTimes: [
    { slot: 'MORNING', time: '08:00' }, { slot: 'NOON', time: '12:00' },
    { slot: 'AFTERNOON', time: '16:00' }, { slot: 'EVENING', time: '20:00' },
  ] };
  const endpoint = `/patients/${patient.id}`;
  assert.equal((await f.req('PATCH', endpoint, other.token, patch)).status, 403);
  assert.equal((await f.req('PATCH', endpoint, device.deviceToken, patch)).status, 401);
  for (const birthYear of [1919, 2011, 1954.5]) assert.equal((await f.req('PATCH', endpoint, user.token, { birthYear })).status, 400);
  const updated = await f.ok('PATCH', endpoint, user.token, patch);
  assert.equal(updated.birthYear, 1956);
  assert.equal(updated.alias, 'Ba');
  assert.deepEqual((await f.ok('GET', endpoint, user.token)).reminderTimes, patch.reminderTimes);
  assert.deepEqual(f.ctx.db.list('doses', { prescriptionId: rx.id }), before);
  const profile = await f.ok('GET', '/device/me', device.deviceToken);
  assert.equal(profile.patientAlias, 'Ba');
  assert.equal(profile.ownerAlias, 'Ba');
  assert.ok(f.ctx.db.list('auditLogs', { patientId: patient.id, actionType: 'PATIENT_UPDATED' }).length);
});

test('delete prescription enforces ownership, hides drafts and blocks further mutations', async t => {
  const f = await fixture(t);
  const user = await f.owner();
  const other = await f.owner();
  const patient = await f.ok('POST', '/patients', user.token, { alias: 'Bo', birthYear: 1954 }, 201);
  const device = await f.pair(user, patient.id);
  const rx = await f.ok('POST', `/patients/${patient.id}/prescriptions`, user.token, prescription(), 201);
  const endpoint = `/prescriptions/${rx.id}`;
  assert.equal((await f.req('DELETE', endpoint)).status, 401);
  assert.equal((await f.req('DELETE', endpoint, device.deviceToken)).status, 401);
  assert.equal((await f.req('DELETE', endpoint, other.token)).status, 403);
  assert.equal(f.ctx.db.get('prescriptions', rx.id).deletedAt, undefined);
  await f.ok('DELETE', endpoint, user.token, undefined, 204);
  assert.deepEqual(await f.ok('GET', `/patients/${patient.id}/prescriptions`, user.token), []);
  assert.deepEqual(await f.ok('GET', `/patients/${patient.id}/prescriptions?status=CANCELLED`, user.token), []);
  for (const [method, suffix, body] of [['GET', ''], ['DELETE', ''], ['PUT', '', prescription()], ['POST', '/confirm', {}], ['POST', '/cancel', {}]]) {
    assert.equal((await f.req(method, endpoint + suffix, user.token, body)).status, 404);
  }
  const deleted = f.ctx.db.get('prescriptions', rx.id);
  assert.equal(deleted.statusBeforeDeletion, 'DRAFT');
  assert.equal(deleted.deletedBy, user.id);
  assert.equal(f.ctx.db.list('auditLogs', { targetId: rx.id, actionType: 'PRESCRIPTION_DELETED' }).length, 1);
});

test('deleting an active prescription stops reminders, preserves history and permits a new active prescription', async t => {
  const f = await fixture(t);
  const user = await f.owner();
  const patient = await f.ok('POST', '/patients', user.token, { alias: 'Bo', birthYear: 1954 }, 201);
  const device = await f.pair(user, patient.id);
  const form = prescription();
  form.items[0].slots = ['MORNING', 'NOON', 'AFTERNOON', 'EVENING'];
  const rx = await f.ok('POST', `/patients/${patient.id}/prescriptions`, user.token, form, 201);
  await f.ok('POST', `/prescriptions/${rx.id}/confirm`, user.token, {}, 202);
  const morning = f.ctx.db.list('doses', { prescriptionId: rx.id }).find(d => d.date === '2026-10-22' && d.slot === 'MORNING');
  const confirmation = await f.ok('POST', `/doses/${morning.id}/confirmations`, device.deviceToken, {}, 201);
  f.time('2026-10-22T08:10:00Z'); // 15:10 Vietnam: noon missed, afternoon pending.
  user.token = (await f.ok('POST', '/auth/login', undefined, { email: user.email, password: PASSWORD })).accessToken;
  tickMedication(f.ctx);
  const before = f.ctx.db.list('doses', { prescriptionId: rx.id });
  assert.ok(before.some(d => d.status === 'PENDING'));
  assert.ok(before.some(d => d.status === 'MISSED'));
  const alertsBefore = f.ctx.db.list('alerts', { patientId: patient.id }).length;
  await f.ok('DELETE', `/prescriptions/${rx.id}`, user.token, undefined, 204);
  const after = f.ctx.db.list('doses', { prescriptionId: rx.id });
  for (const original of before) {
    const actual = after.find(d => d.id === original.id);
    if (['SCHEDULED', 'PENDING'].includes(original.status)) assert.equal(actual.status, 'CANCELLED');
    else assert.deepEqual(actual, original);
  }
  assert.ok(f.ctx.db.get('confirmations', confirmation.id));
  const visible = await f.ok('GET', '/device/doses/today', device.deviceToken);
  assert.deepEqual(visible.map(d => d.id), [morning.id]);
  const missed = after.find(d => d.status === 'MISSED');
  assert.equal((await f.req('POST', `/doses/${missed.id}/confirmations`, device.deviceToken, {})).status, 409);
  // Previously recorded doses can still be corrected by the owner.
  await f.ok('POST', `/doses/${morning.id}/corrections`, user.token, { takenAt: confirmation.takenAt, correctsConfirmationId: confirmation.id }, 201);
  f.time('2026-10-22T16:30:00Z');
  tickMedication(f.ctx);
  assert.equal(f.ctx.db.list('alerts', { patientId: patient.id }).length, alertsBefore);
  user.token = (await f.ok('POST', '/auth/login', undefined, { email: user.email, password: PASSWORD })).accessToken;
  const next = await f.ok('POST', `/patients/${patient.id}/prescriptions`, user.token, prescription(), 201);
  await f.ok('POST', `/prescriptions/${next.id}/confirm`, user.token, {}, 202);
  assert.equal(f.ctx.db.get('prescriptions', next.id).status, 'ACTIVE');
});

test('prescription deletion rolls back dose cancellation if audit fails', async t => {
  const f = await fixture(t);
  const user = await f.owner();
  const patient = await f.ok('POST', '/patients', user.token, { alias: 'Bo', birthYear: 1954 }, 201);
  const rx = await f.ok('POST', `/patients/${patient.id}/prescriptions`, user.token, prescription(), 201);
  await f.ok('POST', `/prescriptions/${rx.id}/confirm`, user.token, {}, 202);
  const before = f.ctx.db.list('doses', { prescriptionId: rx.id });
  const audit = f.ctx.audit;
  f.ctx.audit = event => { if (event.actionType === 'PRESCRIPTION_DELETED') throw new Error('test failure'); return audit(event); };
  assert.equal((await f.req('DELETE', `/prescriptions/${rx.id}`, user.token)).status, 500);
  f.ctx.audit = audit;
  assert.equal(f.ctx.db.get('prescriptions', rx.id).deletedAt, undefined);
  assert.equal(f.ctx.db.get('prescriptions', rx.id).status, 'ACTIVE');
  assert.deepEqual(f.ctx.db.list('doses', { prescriptionId: rx.id }), before);
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

test('caregivers can confirm their own patient’s dose once and keep the original attribution after correction', async t => {
  const f = await fixture(t);
  const user = await f.owner('Lan');
  const other = await f.owner();
  const patient = await f.ok('POST', '/patients', user.token, { alias: 'Bố', birthYear: 1954 }, 201);
  const draft = await f.ok('POST', `/patients/${patient.id}/prescriptions`, user.token, prescription(), 201);
  await f.ok('POST', `/prescriptions/${draft.id}/confirm`, user.token, undefined, 202);
  const doses = await f.ok('GET', `/patients/${patient.id}/doses?from=2026-10-22&to=2026-10-22`, user.token);
  const [morning, evening] = doses;
  const path = `/doses/${morning.id}/confirmations`;
  await f.ok('POST', path, other.token, {}, 403);
  await f.ok('GET', '/device/doses/today', user.token, undefined, 401);
  const original = await f.ok('POST', path, user.token, {}, 201);
  assert.deepEqual([original.actorRole, original.actorId, original.resultingStatus], ['CAREGIVER', user.id, 'TAKEN_BY_DELEGATE']);
  await f.ok('POST', path, user.token, {}, 409);
  const corrected = await f.ok('POST', `/doses/${morning.id}/corrections`, user.token, {
    takenAt: '2026-10-22T00:05:00.000Z', correctsConfirmationId: original.id
  }, 201);
  assert.equal(corrected.resultingStatus, 'TAKEN_BY_DELEGATE');
  const history = await f.ok('GET', path, user.token);
  assert.deepEqual(history.map(c => [c.actorLabel, c.correctsConfirmationId]), [['Lan', null], ['Lan', original.id]]);
  const eveningPath = `/doses/${evening.id}/confirmations`;
  await f.ok('POST', eveningPath, user.token, {}, 422);
  f.time('2026-10-22T13:10:00.000Z');
  const freshToken = (await f.ok('POST', '/auth/login', undefined, { email: user.email, password: PASSWORD })).accessToken;
  assert.equal((await f.ok('POST', eveningPath, freshToken, {}, 201)).resultingStatus, 'LATE_CONFIRMED');
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
  await f.ok('POST', `/doses/${morning.id}/corrections`, user.token, { takenAt: '2026-10-22T00:05:00.000Z', correctsConfirmationId: original.id }, 201);

  const chain = await f.ok('GET', `/doses/${morning.id}/confirmations`, user.token);
  assert.equal(chain.length, 2);
  assert.equal(chain[0].correctsConfirmationId, null);
  assert.equal(chain[1].correctsConfirmationId, original.id);
  assert.equal(chain[0].actorLabel, 'Bố');
  assert.equal(chain[1].actorLabel, user.displayName);
  assert.equal(chain[1].actorRole, 'CAREGIVER');
  assert.equal((await f.req('GET', `/doses/${morning.id}/confirmations`, phone.deviceToken)).status, 401, 'history is for the caregiver');

  const listed = await f.ok('GET', `/patients/${patient.id}/doses?from=2026-10-22&to=2026-10-22`, user.token);
  assert.equal(listed.find((d) => d.id === morning.id).lastConfirmation.actorLabel, user.displayName);
  const last = await f.ok('GET', '/device/doses/last-confirmed', helper.deviceToken);
  assert.deepEqual([last.date, last.slot, last.takenAt, last.actorLabel, last.drugs], ['2026-10-22', 'MORNING', '2026-10-22T00:05:00.000Z', user.displayName, ['Glucophage 500mg']]);

  f.time('2026-10-21T23:00:00.000Z');
  assert.equal(await f.ok('GET', '/device/doses/last-confirmed', helper.deviceToken), null, 'a restarted demo clock must not show a future confirmation as the last intake');
  f.time('2026-10-22T00:10:00.000Z');

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
  assert.equal(new Date(Date.parse(before.now) + 7 * 3600_000).toISOString().slice(11, 16), '06:00');
  const back = await f.req('POST', '/dev/clock', user.token, { to: new Date(Date.parse(before.now) - 60_000).toISOString() });
  assert.equal(back.status, 422);
  assert.equal(back.body.code, 'CLOCK_BACKWARDS');
  assert.equal((await f.req('POST', '/dev/clock', user.token, { advanceMinutes: 30, to: new Date().toISOString() })).status, 400);
  const after = await f.ok('POST', '/dev/clock', user.token, { advanceMinutes: 90 });
  assert.ok(after.offsetMs - before.offsetMs >= 90 * 60_000);
  assert.ok(Date.parse(after.now) - Date.parse(before.now) >= 90 * 60_000);
});

test('skip past a dose deadline marks it missed and sends one alert', async t => {
  const f = await fixture(t, { realClock: true, config: { devTools: true } });
  const user = await f.owner();
  const date = new Date(+f.ctx.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const patient = await f.ok('POST', '/patients', user.token, { alias: 'Bo', birthYear: 1954 }, 201);
  const rx = await f.ok('POST', `/patients/${patient.id}/prescriptions`, user.token, prescription({ issuedDate: date, startDate: date, nextVisitDate: date }), 201);
  await f.ok('POST', `/prescriptions/${rx.id}/confirm`, user.token, undefined, 202);
  const endpoint = `/patients/${patient.id}/doses?from=${date}&to=${date}`;
  const morning = (await f.ok('GET', endpoint, user.token)).find(d => d.slot === 'MORNING');
  assert.equal(morning.status, 'SCHEDULED');
  await f.ok('POST', '/dev/clock', user.token, { to: morning.scheduledAt });
  assert.equal((await f.ok('GET', endpoint, user.token)).find(d => d.id === morning.id).status, 'PENDING');
  await f.ok('POST', '/dev/clock', user.token, { to: new Date(Date.parse(morning.deadlineAt) + 60_000).toISOString() });
  assert.equal((await f.ok('GET', endpoint, user.token)).find(d => d.id === morning.id).status, 'MISSED');
  tickMedication(f.ctx);
  const alerts = await f.ok('GET', `/patients/${patient.id}/alerts`, user.token);
  assert.equal(alerts.filter(a => a.type === 'DOSE_MISSED').length, 1);
});

test('rapid time skips accumulate and preserve the account session', async t => {
  const f = await fixture(t, { realClock: true, config: { devTools: true, refreshTokenDays: 1 } });
  const user = await f.owner();
  const before = await f.ok('GET', '/dev/clock', user.token);
  const advance = advanceMinutes => f.ok('POST', '/dev/clock', user.token, { advanceMinutes });
  await Promise.all([15, 60, 15, 60].map(advance));
  const after = await f.ok('GET', '/dev/clock', user.token);
  assert.equal(after.offsetMs - before.offsetMs, 150 * 60_000);
  await advance(24 * 60);
  assert.equal((await f.ok('GET', '/auth/me', user.token)).id, user.id);
  const rotated = await f.ok('POST', '/auth/refresh', undefined, { refreshToken: user.refreshToken });
  assert.equal((await f.ok('GET', '/auth/me', rotated.accessToken)).id, user.id);
});

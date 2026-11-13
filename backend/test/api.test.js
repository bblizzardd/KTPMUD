import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import path from 'node:path';
import WebSocket from 'ws';
import { createApp } from '../src/app.js';
import { tickMedication } from '../src/medication.js';
import { tickClinical } from '../src/clinical.js';
import { attachRealtime } from '../src/realtime.js';

const PASSWORD = 'AnTam-test-password-2026!';
const DATE = '2026-10-22';

async function removeTestDirectory(directory, prefix) {
  const target = path.resolve(directory);
  assert.equal(path.dirname(target).toLowerCase(), path.resolve(tmpdir()).toLowerCase(), 'cleanup target must be a direct child of the test temp root');
  assert.ok(path.basename(target).startsWith(prefix), 'cleanup target must have the expected test prefix');
  await rm(target, { recursive: true, force: true });
}

async function fixture(t, initialTime = '2026-10-22T00:10:00.000Z', options = {}) {
  let currentTime = new Date(initialTime);
  const reportDir = await mkdtemp(path.join(tmpdir(), 'antam-api-test-'));
  const runtime = await createApp({
    databasePath: options.databasePath ?? ':memory:',
    now: () => new Date(currentTime),
    config: {
      jwtSecret: 'integration-test-secret-which-is-at-least-thirty-two-characters',
      tokenEncryptionKey: '12'.repeat(32),
      reportDir,
      logErrors: false,
    },
  });
  const server = await new Promise((resolve, reject) => {
    const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  runtime.ctx.config.baseUrl = base;
  const cleanups = [];
  let shutdownPromise;
  const shutdown = () => shutdownPromise ??= (async () => {
    for (const cleanup of cleanups) cleanup();
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
    await runtime.close();
  })();
  t.after(async () => {
    await shutdown();
    await removeTestDirectory(reportDir, 'antam-api-test-');
  });
  const users = [];
  const req = async (method, endpoint, token, body) => {
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint.startsWith('/api/') ? '' : '/api/v1'}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const text = bytes.toString('utf8');
    return {
      status: response.status,
      headers: response.headers,
      bytes,
      body: response.headers.get('content-type')?.includes('application/json') && text ? JSON.parse(text) : text,
    };
  };
  const ok = async (method, endpoint, token, body, expectedStatus = 200) => {
    const response = await req(method, endpoint, token, body);
    assert.equal(response.status, expectedStatus, `${method} ${endpoint}: ${JSON.stringify(response.body).slice(0, 800)}`);
    return response.body;
  };
  const login = async user => {
    const tokens = await ok('POST', '/auth/login', undefined, { email: user.email, password: user.password });
    user.token = tokens.accessToken;
    user.refreshToken = tokens.refreshToken;
    return tokens;
  };
  const user = async (name = `user${users.length + 1}`) => {
    const account = { email: `${name}@example.test`, password: PASSWORD, displayName: name };
    const registered = await ok('POST', '/auth/register', undefined, account, 201);
    assert.equal(registered.email, account.email);
    assert.equal('password' in registered, false);
    assert.equal('passwordHash' in registered, false);
    account.id = registered.id;
    users.push(account);
    await login(account);
    return account;
  };
  const patient = (owner, overrides = {}) => ok('POST', '/patients', owner.token, {
    alias: 'Bố', birthYear: 1955, ...overrides,
  }, 201);
  const device = async (owner, patientId, role = 'PATIENT', delegateId) => {
    const pairing = await ok('POST', `/patients/${patientId}/pairing-codes`, owner.token, { role, ...(delegateId ? { delegateId } : {}) }, 201);
    const paired = await ok('POST', '/devices/pair', undefined, { code: pairing.code, pushToken: 'test-push-token', platform: 'ANDROID' });
    assert.equal(paired.role, role);
    return { ...paired, code: pairing.code, token: paired.deviceToken };
  };
  const time = async value => {
    currentTime = new Date(value);
    for (const account of users) await login(account);
  };
  return { ...runtime, server, base, req, ok, user, patient, device, time, login, shutdown, cleanup: fn => cleanups.push(fn) };
}

function prescription(overrides = {}) {
  return {
    issuedDate: DATE,
    startDate: DATE,
    nextVisitDate: '2026-10-24',
    items: [
      { drugNameRaw: 'Thuốc A theo đơn', unitsPerDose: 1, unit: 'viên', slots: ['MORNING', 'NOON'] },
      { drugNameRaw: 'Thuốc B theo đơn', unitsPerDose: 0.5, unit: 'viên', slots: ['MORNING'] },
    ],
    ...overrides,
  };
}

test('patient accounts sign in on web/app, refresh their session and cannot access caregiver or other-patient data', async t => {
  const f = await fixture(t);
  const owner = await f.user();
  const patient = await f.patient(owner);
  const other = await f.patient(owner, { alias: 'Mẹ' });
  await activePrescription(f, owner, patient);
  await activePrescription(f, owner, other);
  const pairing = await f.ok('POST', `/patients/${patient.id}/pairing-codes`, owner.token, { role: 'PATIENT' }, 201);
  const credentials = { email: 'patient@example.test', password: PASSWORD, role: 'PATIENT' };
  const account = await f.ok('POST', '/auth/register', undefined, { ...credentials, displayName: 'Bố', pairingCode: pairing.code }, 201);
  assert.equal(account.patientId, patient.id);
  assert.equal(account.role, 'PATIENT');
  assert.equal('passwordHash' in account, false);
  const web = await f.ok('POST', '/auth/login', undefined, credentials);
  const app = await f.ok('POST', '/auth/login', undefined, credentials);
  assert.equal(web.accountId, app.accountId);
  assert.equal(web.role, 'PATIENT');
  assert.notEqual(web.refreshToken, app.refreshToken);
  assert.equal((await f.ok('GET', '/auth/me', web.accessToken)).id, account.id);
  assert.equal((await f.ok('GET', '/device/me', app.accessToken)).patientId, patient.id);
  const doses = await f.ok('GET', '/device/doses/today', web.accessToken);
  assert.ok(doses.length > 0 && doses.every(d => d.patientId === patient.id));
  await f.ok('GET', '/patients', web.accessToken, undefined, 401);
  await f.ok('POST', `/patients/${patient.id}/prescriptions`, web.accessToken, prescription(), 401);
  await f.ok('GET', '/device/doses/today', owner.token, undefined, 401);
  const otherDose = f.ctx.db.list('doses', { patientId: other.id })[0];
  await f.ok('POST', `/doses/${otherDose.id}/confirmations`, web.accessToken, {}, 403);
  const mine = doses.find(d => d.status === 'PENDING');
  const confirmation = await f.ok('POST', `/doses/${mine.id}/confirmations`, app.accessToken, {}, 201);
  assert.equal(confirmation.actorRole, 'PATIENT');
  assert.equal(confirmation.actorId, account.id);
  const updated = await f.ok('GET', '/device/doses/today', web.accessToken);
  assert.equal(updated.find(d => d.id === mine.id).lastConfirmation.actorLabel, 'Bố');
  const audit = await f.ok('GET', `/patients/${patient.id}/audit-logs?actorRole=PATIENT`, owner.token);
  assert.ok(audit.items.some(log => log.actionType === 'DOSE_CONFIRMED' && log.actorLabel === 'Bố'));
  await f.time('2026-10-22T00:26:00.000Z');
  await f.ok('GET', '/auth/me', web.accessToken, undefined, 401);
  const refreshed = await f.ok('POST', '/auth/refresh', undefined, { refreshToken: web.refreshToken });
  assert.equal(refreshed.role, 'PATIENT');
  assert.equal(refreshed.accountId, account.id);
  await f.ok('GET', '/device/doses/today', refreshed.accessToken);
  await f.ok('POST', '/auth/refresh', undefined, { refreshToken: web.refreshToken }, 401);
  f.ctx.db.update('patientAccounts', account.id, { active: false });
  await f.ok('GET', '/device/me', refreshed.accessToken, undefined, 401);
  await f.ok('POST', '/auth/refresh', undefined, { refreshToken: app.refreshToken }, 401);
});

test('patient registration needs an unused patient pairing code and never creates a caregiver account', async t => {
  const f = await fixture(t);
  const owner = await f.user();
  const patient = await f.patient(owner);
  const body = { email: 'patient@example.test', password: PASSWORD, displayName: 'Bố', role: 'PATIENT' };
  await f.ok('POST', '/auth/register', undefined, body, 400);
  await f.ok('POST', '/auth/register', undefined, { ...body, pairingCode: '999999' }, 410);
  const delegate = await f.ok('POST', `/patients/${patient.id}/delegates`, owner.token, { alias: 'Mẹ', relation: 'Vợ' }, 201);
  const delegateCode = await f.ok('POST', `/patients/${patient.id}/pairing-codes`, owner.token, { role: 'DELEGATE', delegateId: delegate.id }, 201);
  await f.ok('POST', '/auth/register', undefined, { ...body, pairingCode: delegateCode.code }, 410);
  const expired = await f.ok('POST', `/patients/${patient.id}/pairing-codes`, owner.token, { role: 'PATIENT' }, 201);
  await f.time('2026-10-22T00:16:00.000Z');
  await f.ok('POST', '/auth/register', undefined, { ...body, pairingCode: expired.code }, 410);
  const pairing = await f.ok('POST', `/patients/${patient.id}/pairing-codes`, owner.token, { role: 'PATIENT' }, 201);
  const results = await Promise.all([f.req('POST', '/auth/register', undefined, { ...body, pairingCode: pairing.code }), f.req('POST', '/auth/register', undefined, { ...body, pairingCode: pairing.code })]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 410]);
  assert.equal(f.ctx.db.list('patientAccounts').length, 1);
  assert.equal(f.ctx.db.list('caregivers', { email: body.email }).length, 0);
  await f.ok('POST', '/auth/login', undefined, { email: body.email, password: body.password, role: 'CAREGIVER' }, 401);
  await f.ok('POST', '/auth/login', undefined, { email: body.email, password: 'wrong', role: 'PATIENT' }, 401);
  await f.ok('POST', '/devices/pair', undefined, { code: pairing.code, platform: 'ANDROID', pushToken: 'test' }, 410);
});

async function activePrescription(f, owner, patient, input = prescription()) {
  const draft = await f.ok('POST', `/patients/${patient.id}/prescriptions`, owner.token, input, 201);
  const active = await f.ok('POST', `/prescriptions/${draft.id}/confirm`, owner.token, undefined, 202);
  assert.equal(active.status, 'ACTIVE');
  return active;
}

test('registration, login and rotating refresh tokens protect caregiver resources', async t => {
  const f = await fixture(t);
  await f.ok('GET', '/patients', undefined, undefined, 401);
  await f.ok('POST', '/auth/register', undefined, { email: 'invalid', password: 'short', displayName: '' }, 400);
  const owner = await f.user();
  await f.ok('POST', '/auth/register', undefined, { email: owner.email.toUpperCase(), password: PASSWORD, displayName: 'Duplicate' }, 409);
  await f.ok('POST', '/auth/login', undefined, { email: owner.email, password: 'incorrect-password' }, 401);
  await f.ok('GET', '/patients', `${owner.token.slice(0, -5)}xxxxx`, undefined, 401);
  const rotated = await f.ok('POST', '/auth/refresh', undefined, { refreshToken: owner.refreshToken });
  assert.notEqual(rotated.refreshToken, owner.refreshToken);
  assert.ok(rotated.accessToken);
  await f.ok('GET', '/patients', rotated.accessToken);
  await f.ok('POST', '/auth/refresh', undefined, { refreshToken: owner.refreshToken }, 401);
  await f.ok('POST', '/auth/refresh', undefined, { refreshToken: 'not-a-token' }, 401);
});

test('caregivers cannot read or change another caregiver’s patient resources', async t => {
  const f = await fixture(t);
  const owner = await f.user('owner');
  const stranger = await f.user('stranger');
  const patient = await f.patient(owner);
  assert.deepEqual(await f.ok('GET', '/patients', stranger.token), []);
  const root = `/patients/${patient.id}`;
  for (const suffix of ['', '/delegates', '/prescriptions', '/doses?from=2026-10-22&to=2026-10-24', '/adherence/summary', '/alerts', '/lab-results', '/appointments', '/audit-logs']) {
    await f.ok('GET', `${root}${suffix}`, stranger.token, undefined, 403);
  }
  const writes = [
    ['PATCH', '', { alias: 'Changed' }],
    ['POST', '/pairing-codes', { role: 'PATIENT' }],
    ['POST', '/delegates', { alias: 'Mẹ', relation: 'Vợ' }],
    ['POST', '/prescriptions', prescription()],
    ['POST', '/lab-results', { testType: 'HBA1C', value: 6.5, unit: '%', testedDate: DATE }],
    ['POST', '/appointments', { visitDate: '2026-10-24' }],
    ['POST', '/reports', { periodDays: 30 }],
  ];
  for (const [method, suffix, body] of writes) await f.ok(method, `${root}${suffix}`, stranger.token, body, 403);
  const rx = await f.ok('POST', `${root}/prescriptions`, owner.token, prescription(), 201);
  await f.ok('GET', `/prescriptions/${rx.id}`, stranger.token, undefined, 403);
  await f.ok('PUT', `/prescriptions/${rx.id}`, stranger.token, prescription(), 403);
  await f.ok('POST', `/prescriptions/${rx.id}/confirm`, stranger.token, undefined, 403);
  await f.ok('POST', `/prescriptions/${rx.id}/cancel`, stranger.token, undefined, 403);
  assert.equal((await f.ok('GET', root, owner.token)).alias, 'Bố');
});

test('pairing codes are single-use and delegate revocation invalidates devices and unused codes', async t => {
  const f = await fixture(t);
  const owner = await f.user();
  const patient = await f.patient(owner);
  const paired = await f.device(owner, patient.id);
  const listedDevices = await f.ok('GET', `/patients/${patient.id}/devices`, owner.token);
  assert.equal(listedDevices.length, 1);
  assert.equal('tokenHash' in listedDevices[0], false);
  assert.equal('pushTokenEncrypted' in listedDevices[0], false);
  assert.equal(JSON.stringify(listedDevices).includes(paired.token), false);
  await f.ok('GET', '/device/doses/today', paired.token);
  await f.ok('GET', '/patients', paired.token, undefined, 401);
  await f.ok('GET', '/device/doses/today', owner.token, undefined, 401);
  await f.ok('POST', '/devices/pair', undefined, { code: paired.code, pushToken: 'other', platform: 'IOS' }, 410);
  const delegate = await f.ok('POST', `/patients/${patient.id}/delegates`, owner.token, { alias: 'Mẹ', relation: 'Vợ' }, 201);
  const delegateDevice = await f.device(owner, patient.id, 'DELEGATE', delegate.id);
  const unused = await f.ok('POST', `/patients/${patient.id}/pairing-codes`, owner.token, { role: 'DELEGATE', delegateId: delegate.id }, 201);
  await f.ok('GET', '/device/doses/today', delegateDevice.token);
  await f.ok('DELETE', `/patients/${patient.id}/delegates/${delegate.id}`, owner.token, undefined, 204);
  await f.ok('GET', '/device/doses/today', delegateDevice.token, undefined, 401);
  await f.ok('POST', '/devices/pair', undefined, { code: unused.code, pushToken: 'revoked', platform: 'ANDROID' }, 410);
  const expiring = await f.ok('POST', `/patients/${patient.id}/pairing-codes`, owner.token, { role: 'PATIENT' }, 201);
  await f.time('2026-10-22T01:10:00.000Z');
  await f.ok('POST', '/devices/pair', undefined, { code: expiring.code, pushToken: 'expired', platform: 'ANDROID' }, 410);
});

test('prescriptions generate separate doses per item and supersede only future doses', async t => {
  const f = await fixture(t);
  const owner = await f.user();
  const patient = await f.patient(owner);
  const paired = await f.device(owner, patient.id);
  const range = `/patients/${patient.id}/doses?from=2026-10-22&to=2026-10-24`;
  const draft = await f.ok('POST', `/patients/${patient.id}/prescriptions`, owner.token, prescription(), 201);
  assert.equal(draft.status, 'DRAFT');
  assert.deepEqual(await f.ok('GET', range, owner.token), []);
  await f.ok('PUT', `/prescriptions/${draft.id}`, owner.token, prescription({ sourceNote: 'Đơn đã đối chiếu' }));
  await f.ok('POST', `/prescriptions/${draft.id}/confirm`, owner.token, undefined, 202);
  await f.ok('POST', `/prescriptions/${draft.id}/confirm`, owner.token, undefined, 409);
  await f.ok('PUT', `/prescriptions/${draft.id}`, owner.token, prescription(), 409);
  const original = await f.ok('GET', range, owner.token);
  assert.equal(original.length, 9, 'three doses each day, including nextVisitDate');
  assert.equal(new Set(original.map(dose => dose.id)).size, 9);
  const mornings = original.filter(dose => dose.scheduledAt === '2026-10-22T00:00:00.000Z');
  assert.equal(mornings.length, 2, 'two medications at the same time remain separate doses');
  assert.notEqual(mornings[0].prescriptionItemId, mornings[1].prescriptionItemId);
  const confirmation = await f.ok('POST', `/doses/${mornings[0].id}/confirmations`, paired.token, {}, 201);
  assert.equal(confirmation.resultingStatus, 'TAKEN');
  await f.time('2026-10-22T01:00:00.000Z');
  await activePrescription(f, owner, patient, prescription({ sourceNote: 'Đơn thay thế' }));
  assert.equal((await f.ok('GET', `/prescriptions/${draft.id}`, owner.token)).status, 'SUPERSEDED');
  const current = await f.ok('GET', range, owner.token);
  for (const previous of original) {
    const after = current.find(dose => dose.id === previous.id);
    assert.ok(after, 'supersession preserves historical dose IDs');
    if (new Date(previous.scheduledAt) > new Date('2026-10-22T01:00:00.000Z')) assert.equal(after.status, 'CANCELLED');
    else assert.notEqual(after.status, 'CANCELLED');
  }
  const confirmed = current.find(dose => dose.id === mornings[0].id);
  assert.equal(confirmed.status, 'TAKEN');
  assert.equal(confirmed.lastConfirmation.id, confirmation.id);
  const cancelled = original.find(dose => dose.scheduledAt > '2026-10-22T01:00:00.000Z');
  await f.ok('POST', `/doses/${cancelled.id}/confirmations`, paired.token, {}, 409);
});

test('confirmation authorization, duplicate rejection and append-only correction chain', async t => {
  const f = await fixture(t);
  const owner = await f.user();
  const patient = await f.patient(owner);
  const anotherPatient = await f.patient(owner, { alias: 'Mẹ' });
  const paired = await f.device(owner, patient.id);
  const otherDevice = await f.device(owner, anotherPatient.id);
  await activePrescription(f, owner, patient);
  const doses = await f.ok('GET', '/device/doses/today', paired.token);
  const mornings = doses.filter(dose => dose.scheduledAt === '2026-10-22T00:00:00.000Z');
  const endpoint = `/doses/${mornings[0].id}/confirmations`;
  await f.ok('POST', endpoint, owner.token, {}, 401);
  await f.ok('POST', endpoint, otherDevice.token, {}, 403);
  const first = await f.ok('POST', endpoint, paired.token, {}, 201);
  assert.equal(first.actorRole, 'PATIENT');
  await f.ok('POST', endpoint, paired.token, {}, 409);
  const corrected = await f.ok('POST', endpoint, paired.token, { takenAt: '2026-10-22T00:05:00.000Z', correctsConfirmationId: first.id }, 201);
  assert.notEqual(corrected.id, first.id);
  assert.equal(corrected.takenAt, '2026-10-22T00:05:00.000Z');
  await f.ok('POST', endpoint, paired.token, { correctsConfirmationId: first.id }, 409);
  await f.ok('POST', `/doses/${mornings[1].id}/confirmations`, paired.token, { correctsConfirmationId: corrected.id }, 409);
  assert.deepEqual(f.ctx.db.get('confirmations', first.id), first, 'correction does not overwrite the original event');
  assert.throws(() => f.ctx.db.update('confirmations', first.id, { takenAt: corrected.takenAt }), /append-only/);
  assert.deepEqual(f.ctx.db.get('confirmations', first.id), first);
  await f.ok('PATCH', `/confirmations/${first.id}`, paired.token, { takenAt: corrected.takenAt }, 405);
  await f.ok('DELETE', `/doses/${mornings[0].id}/confirmations/${first.id}`, paired.token, undefined, 405);
  await f.ok('DELETE', `/confirmations/${first.id}`, otherDevice.token, undefined, 403);
  const refreshed = await f.ok('GET', '/device/doses/today', paired.token);
  assert.equal(refreshed.find(dose => dose.id === mornings[0].id).lastConfirmation.id, corrected.id);
});

test('offline confirmations use the reported event time and preserve missed-alert history', async t => {
  const f = await fixture(t);
  const owner = await f.user();
  const patient = await f.patient(owner);
  const paired = await f.device(owner, patient.id);
  await activePrescription(f, owner, patient);
  const mornings = (await f.ok('GET', '/device/doses/today', paired.token)).filter(dose => dose.scheduledAt === '2026-10-22T00:00:00.000Z');
  await f.time('2026-10-22T03:00:00.000Z');
  await tickMedication(f.ctx);
  const originalAlerts = await f.ok('GET', `/patients/${patient.id}/alerts`, owner.token);
  assert.equal(originalAlerts.filter(alert => alert.type === 'DOSE_MISSED').length, 2);
  const offline = await f.ok('POST', `/doses/${mornings[0].id}/confirmations`, paired.token, { takenAt: '2026-10-22T00:15:00.000Z' }, 201);
  assert.equal(offline.resultingStatus, 'TAKEN');
  assert.equal(offline.recordedAt, '2026-10-22T03:00:00.000Z');
  const late = await f.ok('POST', `/doses/${mornings[1].id}/confirmations`, paired.token, {}, 201);
  assert.equal(late.resultingStatus, 'LATE_CONFIRMED');
  const alerts = await f.ok('GET', `/patients/${patient.id}/alerts`, owner.token);
  for (const previous of originalAlerts) assert.ok(alerts.some(alert => alert.id === previous.id));
  const summary = await f.ok('GET', `/patients/${patient.id}/adherence/summary?days=7`, owner.token);
  assert.equal(summary.taken, 1);
  assert.equal(summary.lateConfirmed, 1);
  assert.equal(summary.totalDoses, 2, 'future scheduled doses do not dilute adherence');
});

test('scheduler marks missed doses once and day queries respect Vietnam midnight', async t => {
  const f = await fixture(t, '2026-10-21T16:59:00.000Z');
  const owner = await f.user();
  const patient = await f.patient(owner);
  const paired = await f.device(owner, patient.id);
  await activePrescription(f, owner, patient, prescription({ issuedDate: '2026-10-21', startDate: '2026-10-21' }));
  const before = await f.ok('GET', '/device/doses/today', paired.token);
  assert.equal(before.length, 3);
  assert.ok(before.every(dose => dose.scheduledAt.startsWith('2026-10-21')));
  await f.time('2026-10-21T17:00:00.000Z');
  const after = await f.ok('GET', '/device/doses/today', paired.token);
  assert.equal(after.length, 3);
  assert.ok(after.every(dose => dose.scheduledAt.startsWith('2026-10-22')));
  assert.deepEqual((await f.ok('GET', `/patients/${patient.id}/doses?from=2026-10-22&to=2026-10-22`, owner.token)).map(dose => dose.id).sort(), after.map(dose => dose.id).sort());
  await f.time('2026-10-22T02:01:00.000Z');
  await tickMedication(f.ctx);
  await tickMedication(f.ctx);
  const missed = await f.ok('GET', `/patients/${patient.id}/doses?from=2026-10-22&to=2026-10-22&status=MISSED`, owner.token);
  assert.equal(missed.length, 2);
  const alerts = await f.ok('GET', `/patients/${patient.id}/alerts`, owner.token);
  for (const dose of missed) assert.equal(alerts.filter(alert => alert.type === 'DOSE_MISSED' && alert.relatedDoseId === dose.id).length, 1);
});

test('invalid fields, impossible dates and query parameters return structured validation errors', async t => {
  const f = await fixture(t);
  const owner = await f.user();
  const patient = await f.patient(owner);
  const root = `/patients/${patient.id}`;
  const cases = [
    ['POST', '/patients', { alias: 'Bố', birthYear: 2020 }],
    ['PATCH', root, { missedThresholdMinutes: 1 }],
    ['PATCH', root, { reminderTimes: [{ slot: 'MORNING', time: '25:00' }] }],
    ['POST', `${root}/prescriptions`, prescription({ startDate: '2026-02-30' })],
    ['POST', `${root}/prescriptions`, prescription({ items: [{ drugNameRaw: 'A', unitsPerDose: -1, slots: ['MORNING'] }] })],
    ['POST', `${root}/lab-results`, { testType: 'HBA1C', value: -1, unit: '%', testedDate: DATE }],
    ['POST', `${root}/appointments`, { visitDate: '2026-02-30' }],
    ['POST', `${root}/reports`, { periodDays: 7 }],
    ['GET', `${root}/doses?from=2026-02-30&to=2026-10-22`],
    ['GET', `${root}/doses?from=2026-10-24&to=2026-10-22`],
    ['GET', `${root}/adherence/summary?days=8`],
    ['GET', `${root}/audit-logs?page=0&size=101`],
    ['GET', '/drugs?q=m'],
    ['GET', '/drugs?q=met&limit=21'],
  ];
  for (const [method, endpoint, body] of cases) {
    const error = await f.ok(method, endpoint, owner.token, body, 400);
    assert.equal(typeof error.code, 'string');
    assert.equal(typeof error.message, 'string');
  }
});

test('clinical records, appointment alerts, PDF download authorization and immutable audit trail', async t => {
  const f = await fixture(t);
  const owner = await f.user('owner');
  const stranger = await f.user('stranger');
  const patient = await f.patient(owner);
  const paired = await f.device(owner, patient.id);
  const root = `/patients/${patient.id}`;
  const lab = await f.ok('POST', `${root}/lab-results`, owner.token, { testType: 'HBA1C', value: 6.5, unit: '%', testedDate: DATE, note: 'Kết quả theo phiếu xét nghiệm' }, 201);
  assert.equal((await f.ok('GET', `${root}/lab-results`, owner.token))[0].id, lab.id);
  await f.ok('POST', `${root}/appointments`, owner.token, { visitDate: '2026-10-24', remindDaysBefore: 2, note: 'Tái khám theo hẹn' }, 201);
  await tickClinical(f.ctx);
  await tickClinical(f.ctx);
  assert.equal((await f.ok('GET', `${root}/alerts`, owner.token)).filter(alert => alert.type === 'VISIT_UPCOMING').length, 1);
  const report = await f.ok('POST', `${root}/reports`, owner.token, { periodDays: 30 }, 202);
  await f.ok('GET', `/reports/${report.id}`, stranger.token, undefined, 403);
  await tickClinical(f.ctx);
  const ready = await f.ok('GET', `/reports/${report.id}`, owner.token);
  assert.equal(ready.status, 'READY', JSON.stringify(ready));
  assert.ok(ready.downloadUrl);
  await f.ok('GET', ready.downloadUrl, undefined, undefined, 401);
  await f.ok('GET', ready.downloadUrl, stranger.token, undefined, 403);
  await f.ok('GET', ready.downloadUrl, paired.token, undefined, 401);
  const pdf = await f.req('GET', ready.downloadUrl, owner.token);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get('content-type'), /application\/pdf/);
  assert.equal(pdf.bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.bytes.length > 1000);
  const audit = await f.ok('GET', `${root}/audit-logs?size=100`, owner.token);
  assert.ok(audit.total >= 4);
  assert.ok(audit.items.every(entry => entry.timestamp && entry.actionType && entry.targetId));
  const storedAudit = f.ctx.db.list('auditLogs', { patientId: patient.id })[0];
  assert.throws(() => f.ctx.db.update('auditLogs', storedAudit.id, { actionType: 'ALTERED' }), /append-only/);
  await f.ok('PATCH', `${root}/audit-logs`, owner.token, { actionType: 'ALTERED' }, 405);
  await f.ok('DELETE', `${root}/audit-logs`, owner.token, undefined, 405);
  const preserved = await f.ok('GET', `${root}/audit-logs?size=100`, owner.token);
  for (const original of audit.items) assert.ok(preserved.items.some(entry => JSON.stringify(entry) === JSON.stringify(original)), 'existing audit rows remain unchanged');
});

test('concurrent refresh and dose confirmation requests consume their single-use state once', async t => {
  const f = await fixture(t);
  const owner = await f.user();
  const refreshes = await Promise.all([
    f.req('POST', '/auth/refresh', undefined, { refreshToken: owner.refreshToken }),
    f.req('POST', '/auth/refresh', undefined, { refreshToken: owner.refreshToken }),
  ]);
  assert.deepEqual(refreshes.map(response => response.status).sort(), [200, 401]);
  const patient = await f.patient(owner);
  const paired = await f.device(owner, patient.id);
  await activePrescription(f, owner, patient);
  const dose = (await f.ok('GET', '/device/doses/today', paired.token)).find(item => item.slot === 'MORNING');
  const confirmations = await Promise.all([
    f.req('POST', `/doses/${dose.id}/confirmations`, paired.token, {}),
    f.req('POST', `/doses/${dose.id}/confirmations`, paired.token, {}),
  ]);
  assert.deepEqual(confirmations.map(response => response.status).sort(), [201, 409]);
  assert.equal(f.ctx.db.list('confirmations', { doseId: dose.id }).length, 1);
});

test('deadline equality permits delegate confirmation and expiration follows the local calendar', async t => {
  const f = await fixture(t);
  const owner = await f.user();
  const patient = await f.patient(owner);
  const delegate = await f.ok('POST', `/patients/${patient.id}/delegates`, owner.token, { alias: 'Mẹ', relation: 'Vợ' }, 201);
  const paired = await f.device(owner, patient.id, 'DELEGATE', delegate.id);
  const rx = await activePrescription(f, owner, patient, prescription({ nextVisitDate: DATE }));
  await f.time('2026-10-22T01:00:00.000Z');
  const atDeadline = (await f.ok('GET', '/device/doses/today', paired.token)).filter(item => item.slot === 'MORNING');
  assert.ok(atDeadline.every(dose => dose.status === 'PENDING'));
  const confirmation = await f.ok('POST', `/doses/${atDeadline[0].id}/confirmations`, paired.token, {}, 201);
  assert.equal(confirmation.actorRole, 'DELEGATE');
  assert.equal(confirmation.resultingStatus, 'TAKEN_BY_DELEGATE');
  await f.time('2026-10-22T01:00:00.001Z');
  await tickMedication(f.ctx);
  assert.equal(f.ctx.db.get('doses', atDeadline[1].id).status, 'MISSED');
  await f.time('2026-10-22T16:59:59.999Z');
  assert.equal((await f.ok('GET', `/prescriptions/${rx.id}`, owner.token)).status, 'ACTIVE');
  await f.time('2026-10-22T17:00:00.000Z');
  assert.equal((await f.ok('GET', `/prescriptions/${rx.id}`, owner.token)).status, 'EXPIRED');
});

test('confirmation event times reject future, early, different-day and stale offline events', async t => {
  const f = await fixture(t);
  const owner = await f.user();
  const patient = await f.patient(owner);
  const paired = await f.device(owner, patient.id);
  await activePrescription(f, owner, patient);
  const morning = (await f.ok('GET', '/device/doses/today', paired.token)).filter(item => item.slot === 'MORNING');
  const endpoint = `/doses/${morning[0].id}/confirmations`;
  await f.ok('POST', endpoint, paired.token, { takenAt: '2026-10-22T00:11:00.000Z' }, 422);
  await f.ok('POST', endpoint, paired.token, { takenAt: '2026-10-21T22:59:59.999Z' }, 422);
  await f.ok('POST', endpoint, paired.token, { takenAt: '2026-02-30T00:10:00.000Z' }, 400);
  await f.time('2026-10-23T01:00:00.000Z');
  await f.ok('POST', endpoint, paired.token, { takenAt: '2026-10-23T00:10:00.000Z' }, 422);
  await f.time('2026-10-25T00:10:00.000Z');
  await f.ok('POST', endpoint, paired.token, { takenAt: '2026-10-22T00:09:59.999Z' }, 422);
  const accepted = await f.ok('POST', endpoint, paired.token, { takenAt: '2026-10-22T00:10:00.000Z' }, 201);
  assert.equal(accepted.resultingStatus, 'TAKEN', 'exactly72h uploads remain within the configured window');
});

test('expired access tokens and explicitly revoked devices lose access', async t => {
  const f = await fixture(t);
  const owner = await f.user('owner');
  const stranger = await f.user('stranger');
  const patient = await f.patient(owner);
  const paired = await f.device(owner, patient.id);
  await f.ok('DELETE', `/patients/${patient.id}/devices/${paired.deviceId}`, stranger.token, undefined, 403);
  await f.ok('GET', '/device/doses/today', paired.token);
  const originalAccess = owner.token;
  await f.time('2026-10-22T00:25:00.000Z');
  await f.ok('GET', '/patients', originalAccess, undefined, 401);
  await f.ok('GET', '/patients', owner.token);
  await f.ok('DELETE', `/patients/${patient.id}/devices/${paired.deviceId}`, owner.token, undefined, 204);
  await f.ok('GET', '/device/doses/today', paired.token, undefined, 401);
  assert.equal((await f.ok('GET', `/patients/${patient.id}`, owner.token)).pairedDevice, false);
});

test('WebSocket authentication isolates owner alerts and closes expired sessions', async t => {
  const f = await fixture(t);
  const owner = await f.user('owner');
  const stranger = await f.user('stranger');
  const patient = await f.patient(owner);
  const otherPatient = await f.patient(stranger);
  const stopRealtime = attachRealtime(f.server, f.ctx);
  const sockets = [];
  f.cleanup(() => { for (const socket of sockets) socket.terminate(); stopRealtime(); });
  const waitFor = (socket, event) => once(socket, event, { signal: AbortSignal.timeout(3000) });
  const open = async () => {
    const socket = new WebSocket(`${f.base.replace('http:', 'ws:')}/ws/alerts`);
    sockets.push(socket);
    socket.on('error', () => {});
    await waitFor(socket, 'open');
    return socket;
  };
  const authenticated = async account => {
    const socket = await open();
    const acknowledgement = waitFor(socket, 'message');
    socket.send(JSON.stringify({ type: 'authenticate', token: account.token }));
    assert.equal(JSON.parse((await acknowledgement)[0].toString()).type, 'authenticated');
    return socket;
  };
  const ownerSocket = await authenticated(owner);
  const strangerSocket = await authenticated(stranger);
  const invalidSocket = await open();
  const denied = waitFor(invalidSocket, 'close');
  invalidSocket.send(JSON.stringify({ type: 'authenticate', token: 'invalid-token' }));
  assert.equal((await denied)[0], 4401);
  const ownerAlert = waitFor(ownerSocket, 'message');
  const strangerAlert = waitFor(strangerSocket, 'message');
  f.ctx.events.emit('alert', { id: 'owner-alert', patientId: patient.id, type: 'DOSE_MISSED' });
  f.ctx.events.emit('alert', { id: 'other-alert', patientId: otherPatient.id, type: 'DOSE_MISSED' });
  assert.equal(JSON.parse((await ownerAlert)[0].toString()).alert.patientId, patient.id);
  assert.equal(JSON.parse((await strangerAlert)[0].toString()).alert.patientId, otherPatient.id);
  await f.time('2026-10-22T00:25:00.000Z');
  const expired = waitFor(ownerSocket, 'close');
  f.ctx.events.emit('alert', { id: 'expired-alert', patientId: patient.id, type: 'DOSE_MISSED' });
  assert.equal((await expired)[0], 4401);
});

test('SQLite records, credentials and immutability constraints survive application restart', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antam-persistence-test-'));
  const fixtures = [];
  t.after(async () => {
    for (const instance of fixtures) await instance.shutdown();
    await removeTestDirectory(directory, 'antam-persistence-test-');
  });
  const databasePath = path.join(directory, 'test.sqlite');
  const first = await fixture(t, undefined, { databasePath });
  fixtures.push(first);
  const owner = await first.user();
  const patient = await first.patient(owner);
  const paired = await first.device(owner, patient.id);
  const rx = await activePrescription(first, owner, patient);
  const dose = (await first.ok('GET', '/device/doses/today', paired.token)).find(item => item.slot === 'MORNING');
  const confirmation = await first.ok('POST', `/doses/${dose.id}/confirmations`, paired.token, {}, 201);
  const audit = first.ctx.db.list('auditLogs', { patientId: patient.id });
  await first.shutdown();
  const reopened = await fixture(t, undefined, { databasePath });
  fixtures.push(reopened);
  assert.equal((await reopened.ok('GET', `/patients/${patient.id}`, owner.token)).alias, patient.alias);
  assert.equal((await reopened.ok('GET', `/prescriptions/${rx.id}`, owner.token)).status, 'ACTIVE');
  const restoredDose = (await reopened.ok('GET', '/device/doses/today', paired.token)).find(item => item.id === dose.id);
  assert.equal(restoredDose.status, 'TAKEN');
  assert.equal(restoredDose.lastConfirmation.id, confirmation.id);
  assert.deepEqual(reopened.ctx.db.get('confirmations', confirmation.id), confirmation);
  for (const event of audit) assert.deepEqual(reopened.ctx.db.get('auditLogs', event.id), event);
  assert.throws(() => reopened.ctx.db.update('confirmations', confirmation.id, { resultingStatus: 'MISSED' }), /append-only/);
  assert.throws(() => reopened.ctx.db.update('auditLogs', audit[0].id, { actionType: 'ALTERED' }), /append-only/);
  await reopened.ok('POST', '/auth/login', undefined, { email: owner.email, password: PASSWORD });
  await reopened.ok('POST', '/auth/refresh', undefined, { refreshToken: owner.refreshToken });
});

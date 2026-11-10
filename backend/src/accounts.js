import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { ApiError, DEFAULT_REMINDERS, TIME_SLOTS, newId, parse } from './common.js';
import { createTokenPair, encryptToken, hashPassword, hashToken, opaqueToken, verifyPassword } from './security.js';

const text = max => z.string().trim().min(1).max(max);
const email = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const password = z.string().min(8).max(128);
const reminders = z.array(z.object({ slot: z.enum(TIME_SLOTS), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).strict())
  .min(1).max(4).refine(items => new Set(items.map(item => item.slot)).size === items.length, 'Mỗi buổi chỉ được khai báo một lần');
const patientCreate = z.object({ alias: text(50), birthYear: z.number().int().min(1920).max(2010), reminderTimes: reminders.optional() }).strict();
const patientUpdate = z.object({ alias: text(50).optional(), reminderTimes: reminders.optional(), missedThresholdMinutes: z.number().int().min(15).max(360).optional() }).strict()
  .refine(value => Object.keys(value).length > 0, 'Cần ít nhất một trường cập nhật');

export function publicRateLimit(ctx, max = 20, windowMs = 60000) {
  const attempts = new Map();
  return (req, res, next) => {
    const now = +ctx.now();
    for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
    // Express matches routes case-insensitively and accepts a trailing slash.
    // Use the registered path so URL spelling cannot create a fresh bucket.
    const key = `${req.ip}:${req.route?.path || req.path.toLowerCase()}`;
    const item = attempts.get(key) || { count: 0, until: now + windowMs };
    item.count++;
    attempts.set(key, item);
    if (item.count > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((item.until - now) / 1000))));
      throw new ApiError(429, 'RATE_LIMITED', 'Quá nhiều lần thử. Vui lòng thử lại sau');
    }
    next();
  };
}

function publicCaregiver(record) {
  const { id, email, displayName, createdAt } = record;
  return { id, email, displayName, createdAt };
}
function publicDevice(record) {
  const { tokenHash, pushTokenEncrypted, ...visible } = record;
  return visible;
}
function publicPatient(ctx, patient) {
  const pairedDevice = ctx.db.list('devices', { patientId: patient.id, active: true, role: 'PATIENT' })
    .some(device => Date.parse(device.expiresAt) > +ctx.now());
  return { ...patient, pairedDevice };
}

export function registerAccountRoutes(router, ctx) {
  const { db } = ctx;
  const limit = publicRateLimit(ctx);
  router.post('/auth/register', limit, async (req, res) => {
    const input = parse(z.object({ email, password, displayName: text(100) }).strict(), req.body);
    const passwordHash = await hashPassword(input.password);
    const caregiver = db.transaction(() => {
      if (db.list('caregivers', { email: input.email }).length) throw new ApiError(409, 'EMAIL_EXISTS', 'Email đã được đăng ký');
      const record = db.insert('caregivers', { id: newId(), email: input.email, displayName: input.displayName, passwordHash, createdAt: ctx.now().toISOString() });
      ctx.audit({ userId: record.id, actionType: 'ACCOUNT_REGISTERED', targetType: 'Caregiver', targetId: record.id });
      return record;
    });
    res.status(201).json(publicCaregiver(caregiver));
  });
  router.post('/auth/login', limit, async (req, res) => {
    const input = parse(z.object({ email, password: z.string().min(1).max(128) }).strict(), req.body);
    const caregiver = db.list('caregivers', { email: input.email })[0];
    const valid = await verifyPassword(input.password, caregiver?.passwordHash || ctx.dummyPasswordHash);
    if (!caregiver || !valid) {
      ctx.audit({ userId: caregiver?.id, actionType: 'LOGIN', targetType: 'Caregiver', targetId: caregiver?.id, status: 'FAILURE' });
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
    }
    const tokens = await createTokenPair(ctx, caregiver.id);
    db.transaction(() => {
      db.insert('refreshTokens', tokens.record);
      ctx.audit({ userId: caregiver.id, actionType: 'LOGIN', targetType: 'Caregiver', targetId: caregiver.id });
    });
    res.json(tokens.response);
  });
  router.post('/auth/refresh', limit, async (req, res) => {
    const { refreshToken } = parse(z.object({ refreshToken: text(512) }).strict(), req.body);
    const previous = db.list('refreshTokens', { tokenHash: hashToken(refreshToken) })[0];
    if (!previous || previous.used || Date.parse(previous.expiresAt) <= +ctx.now()) throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token đã hết hạn hoặc đã dùng');
    const tokens = await createTokenPair(ctx, previous.caregiverId);
    db.transaction(() => {
      if (db.get('refreshTokens', previous.id).used) throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token đã dùng');
      db.update('refreshTokens', previous.id, { used: true });
      db.insert('refreshTokens', tokens.record);
      ctx.audit({ userId: previous.caregiverId, actionType: 'TOKEN_REFRESHED', targetType: 'Caregiver', targetId: previous.caregiverId });
    });
    res.json(tokens.response);
  });
  router.get('/auth/me', ctx.caregiver, (req, res) => res.json(publicCaregiver(db.get('caregivers', req.actor.id))));

  router.get('/patients', ctx.caregiver, (req, res) => res.json(db.list('patients', { caregiverId: req.actor.id }).map(patient => publicPatient(ctx, patient))));
  router.post('/patients', ctx.caregiver, (req, res) => {
    const input = parse(patientCreate, req.body);
    const patient = db.transaction(() => {
      const record = db.insert('patients', { ...input, id: newId(), caregiverId: req.actor.id,
        reminderTimes: input.reminderTimes || DEFAULT_REMINDERS, missedThresholdMinutes: 120, createdAt: ctx.now().toISOString() });
      ctx.audit({ patientId: record.id, userId: req.actor.id, actionType: 'PATIENT_CREATED', targetType: 'Patient', targetId: record.id });
      return record;
    });
    res.status(201).json(publicPatient(ctx, patient));
  });
  router.get('/patients/:patientId', ctx.caregiver, (req, res) => res.json(publicPatient(ctx, ctx.patientAccess(req, req.params.patientId))));
  router.patch('/patients/:patientId', ctx.caregiver, (req, res) => {
    const patient = ctx.patientAccess(req, req.params.patientId);
    const input = parse(patientUpdate, req.body);
    const result = db.transaction(() => {
      const updated = db.update('patients', patient.id, input);
      // Snapshot existing doses; new settings apply only when a new prescription is confirmed.
      ctx.audit({ patientId: patient.id, userId: req.actor.id, actionType: 'PATIENT_UPDATED', targetType: 'Patient', targetId: patient.id });
      return updated;
    });
    res.json(publicPatient(ctx, result));
  });

  router.get('/patients/:patientId/delegates', ctx.caregiver, (req, res) => {
    ctx.patientAccess(req, req.params.patientId);
    res.json(db.list('delegates', { patientId: req.params.patientId }));
  });
  router.post('/patients/:patientId/delegates', ctx.caregiver, (req, res) => {
    const patient = ctx.patientAccess(req, req.params.patientId);
    const input = parse(z.object({ alias: text(50), relation: text(50) }).strict(), req.body);
    const delegate = db.transaction(() => {
      const record = db.insert('delegates', { ...input, id: newId(), patientId: patient.id, active: true, createdAt: ctx.now().toISOString() });
      ctx.audit({ patientId: patient.id, userId: req.actor.id, actionType: 'DELEGATE_CREATED', targetType: 'Delegate', targetId: record.id });
      return record;
    });
    res.status(201).json(delegate);
  });
  router.delete('/patients/:patientId/delegates/:delegateId', ctx.caregiver, (req, res) => {
    const patient = ctx.patientAccess(req, req.params.patientId);
    const delegate = db.get('delegates', req.params.delegateId);
    if (!delegate || delegate.patientId !== patient.id) throw new ApiError(404, 'DELEGATE_NOT_FOUND', 'Không tìm thấy người nhà');
    db.transaction(() => {
      db.update('delegates', delegate.id, { active: false });
      for (const device of db.list('devices', { delegateId: delegate.id, active: true })) {
        db.update('devices', device.id, { active: false, revokedAt: ctx.now().toISOString() });
        ctx.audit({ patientId: patient.id, userId: req.actor.id, actionType: 'DEVICE_REVOKED', targetType: 'Device', targetId: device.id });
      }
      for (const code of db.list('pairingCodes', { delegateId: delegate.id, used: false })) db.update('pairingCodes', code.id, { used: true });
      ctx.audit({ patientId: patient.id, userId: req.actor.id, actionType: 'DELEGATE_REVOKED', targetType: 'Delegate', targetId: delegate.id });
    });
    res.status(204).end();
  });
  router.post('/patients/:patientId/pairing-codes', ctx.caregiver, (req, res) => {
    const patient = ctx.patientAccess(req, req.params.patientId);
    const input = parse(z.object({ role: z.enum(['PATIENT', 'DELEGATE']), delegateId: z.string().uuid().optional() }).strict(), req.body);
    if (input.role === 'DELEGATE') {
      const delegate = input.delegateId && db.get('delegates', input.delegateId);
      if (!delegate?.active || delegate.patientId !== patient.id) throw new ApiError(400, 'INVALID_DELEGATE', 'Người nhà phải được ủy quyền trên hồ sơ này');
    } else if (input.delegateId) throw new ApiError(400, 'INVALID_DELEGATE', 'Thiết bị bệnh nhân không dùng delegateId');
    let code;
    do { code = randomInt(0, 1000000).toString().padStart(6, '0'); } while (db.list('pairingCodes', { codeHash: hashToken(code) }).length);
    const expiresAt = new Date(+ctx.now() + ctx.config.pairingMinutes * 60000).toISOString();
    db.transaction(() => {
      const record = db.insert('pairingCodes', { id: newId(), patientId: patient.id, ...input, codeHash: hashToken(code), expiresAt, used: false });
      ctx.audit({ patientId: patient.id, userId: req.actor.id, actionType: 'PAIRING_CODE_CREATED', targetType: 'PairingCode', targetId: record.id });
    });
    res.status(201).json({ code, role: input.role, expiresAt });
  });
  router.post('/devices/pair', publicRateLimit(ctx, 10), (req, res) => {
    const input = parse(z.object({ code: z.string().regex(/^\d{6}$/), pushToken: text(4096), platform: z.enum(['ANDROID', 'IOS']), deviceName: text(100).optional() }).strict(), req.body);
    const deviceToken = opaqueToken();
    const result = db.transaction(() => {
      const code = db.list('pairingCodes', { codeHash: hashToken(input.code) })[0];
      const delegate = code?.delegateId ? db.get('delegates', code.delegateId) : null;
      if (!code || code.used || Date.parse(code.expiresAt) <= +ctx.now() || (code.role === 'DELEGATE' && !delegate?.active)) throw new ApiError(410, 'PAIRING_CODE_GONE', 'Mã đã hết hạn, đã dùng hoặc không hợp lệ');
      const patient = db.get('patients', code.patientId);
      db.update('pairingCodes', code.id, { used: true });
      const device = db.insert('devices', { id: newId(), patientId: patient.id, role: code.role, delegateId: code.delegateId || null,
        ownerAlias: delegate?.alias || patient.alias, deviceName: input.deviceName || input.platform, platform: input.platform,
        tokenHash: hashToken(deviceToken), pushTokenEncrypted: encryptToken(input.pushToken, ctx.config.tokenEncryptionKey), active: true,
        pairedAt: ctx.now().toISOString(), expiresAt: new Date(+ctx.now() + ctx.config.deviceTokenDays * 86400_000).toISOString() });
      ctx.audit({ patientId: patient.id, userId: device.id, actionType: 'DEVICE_PAIRED', targetType: 'Device', targetId: device.id });
      return { deviceToken, deviceId: device.id, patientId: patient.id, role: code.role, patientAlias: patient.alias, ownerAlias: device.ownerAlias, expiresAt: device.expiresAt };
    });
    res.json(result);
  });
  // Lets the phone app check its token (401 after revocation) and greet the right person.
  router.get('/device/me', ctx.device, (req, res) => {
    const device = db.get('devices', req.actor.id);
    const patient = db.get('patients', device.patientId);
    res.json({ deviceId: device.id, role: device.role, patientId: patient.id, patientAlias: patient.alias,
      ownerAlias: device.ownerAlias, deviceName: device.deviceName, pairedAt: device.pairedAt, expiresAt: device.expiresAt });
  });
  router.get('/patients/:patientId/devices', ctx.caregiver, (req, res) => {
    ctx.patientAccess(req, req.params.patientId);
    res.json(db.list('devices', { patientId: req.params.patientId }).map(publicDevice));
  });
  router.delete('/patients/:patientId/devices/:deviceId', ctx.caregiver, (req, res) => {
    const patient = ctx.patientAccess(req, req.params.patientId);
    const device = db.get('devices', req.params.deviceId);
    if (!device || device.patientId !== patient.id) throw new ApiError(404, 'DEVICE_NOT_FOUND', 'Không tìm thấy thiết bị');
    db.transaction(() => {
      db.update('devices', device.id, { active: false, revokedAt: ctx.now().toISOString() });
      ctx.audit({ patientId: patient.id, userId: req.actor.id, actionType: 'DEVICE_REVOKED', targetType: 'Device', targetId: device.id });
    });
    res.status(204).end();
  });
}

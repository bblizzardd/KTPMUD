import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';
import { ApiError, newId } from './common.js';

const derive = promisify(scrypt);
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export const opaqueToken = () => randomBytes(32).toString('base64url');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, hash) {
  const [, salt, expected] = hash.split(':');
  const actual = await derive(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function encryptToken(value, keyHex) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(x => x.toString('base64url')).join('.');
}
export function decryptToken(value, keyHex) {
  const [iv, tag, data] = value.split('.').map(x => Buffer.from(x, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}

export function accountTable(role) {
  return role === 'CAREGIVER' ? 'caregivers' : 'patientAccounts';
}

export function accountEnabled(ctx, account, role) {
  if (!account || (account.testAccount && !ctx.config.testAccounts)) return false;
  if (role === 'CAREGIVER') return true;
  if (!account.active || !ctx.db.get('patients', account.patientId)) return false;
  if (role === 'PATIENT') return !account.delegateId;
  const delegate = account.delegateId && ctx.db.get('delegates', account.delegateId);
  return role === 'DELEGATE' && delegate?.active && delegate.patientId === account.patientId;
}

export async function createTokenPair(ctx, accountId, role = 'CAREGIVER') {
  const now = Math.floor(+ctx.now() / 1000);
  const accessToken = await new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' })
    .setIssuer('antam').setAudience('antam-web').setSubject(accountId).setJti(newId())
    .setIssuedAt(now).setExpirationTime(now + ctx.config.accessTokenSeconds)
    .sign(new TextEncoder().encode(ctx.config.jwtSecret));
  const refreshToken = opaqueToken();
  return {
    response: { accessToken, refreshToken, expiresIn: ctx.config.accessTokenSeconds, role, accountId },
    record: { id: newId(), ...(role === 'CAREGIVER' ? { caregiverId: accountId } : { patientAccountId: accountId }), role, tokenHash: hashToken(refreshToken), used: false,
      expiresAt: new Date(+ctx.now() + ctx.config.refreshTokenDays * 86400_000).toISOString(), createdAt: ctx.now().toISOString() },
  };
}

export function buildSecurity(ctx) {
  function bearer(req) {
    const match = /^Bearer (\S{1,4096})$/i.exec(req.headers.authorization || '');
    if (!match) throw new ApiError(401, 'UNAUTHORIZED', 'Cần token xác thực hợp lệ');
    return match[1];
  }
  async function authenticateAccount(token, requiredRole) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(ctx.config.jwtSecret), {
        algorithms: ['HS256'], issuer: 'antam', audience: 'antam-web', currentDate: ctx.now(),
      });
      if (!['CAREGIVER', 'PATIENT', 'DELEGATE'].includes(payload.role) || (requiredRole && payload.role !== requiredRole)) throw new Error('Invalid role');
      const account = ctx.db.get(accountTable(payload.role), payload.sub);
      if (!accountEnabled(ctx, account, payload.role)) throw new Error('Invalid user');
      return { id: payload.sub, role: payload.role, ...(payload.role !== 'CAREGIVER' ? { patientId: account.patientId, accountAuth: true } : {}), expiresAt: payload.exp * 1000 };
    } catch { throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn'); }
  }
  ctx.authenticateCaregiver = token => authenticateAccount(token, 'CAREGIVER');
  ctx.account = async (req, res, next) => { req.actor = await authenticateAccount(bearer(req)); next(); };
  ctx.caregiver = async (req, res, next) => { req.actor = await ctx.authenticateCaregiver(bearer(req)); next(); };
  async function authenticateDeviceOrAccount(req, next, allowCaregiver = false) {
    const raw = bearer(req);
    if (raw.split('.').length === 3) {
      const actor = await authenticateAccount(raw);
      if (!allowCaregiver && actor.role === 'CAREGIVER') throw new ApiError(401, 'UNAUTHORIZED', 'Cần tài khoản liên kết với hồ sơ');
      req.actor = actor;
      if (req.actor.patientId) req.auditContext = { patientId: req.actor.patientId, targetType: 'Patient', targetId: req.actor.patientId };
      next();
      return;
    }
    const token = ctx.db.list('devices', { tokenHash: hashToken(raw) })[0];
    const delegate = token?.delegateId ? ctx.db.get('delegates', token.delegateId) : null;
    if (!token?.active || Date.parse(token.expiresAt) <= +ctx.now() || (token.role === 'DELEGATE' && !delegate?.active)) {
      throw new ApiError(401, 'DEVICE_UNAUTHORIZED', 'Thiết bị đã hết hạn hoặc bị thu hồi. Hãy ghép nối lại');
    }
    req.actor = { id: token.id, role: token.role, patientId: token.patientId, delegateId: token.delegateId || null };
    req.auditContext = { patientId: token.patientId, targetType: 'Device', targetId: token.id };
    next();
  }
  ctx.device = (req, res, next) => authenticateDeviceOrAccount(req, next);
  ctx.confirmationActor = (req, res, next) => authenticateDeviceOrAccount(req, next, true);
  ctx.patientAccess = (req, patientId) => {
    const patient = ctx.db.get('patients', patientId);
    if (!patient) throw new ApiError(404, 'PATIENT_NOT_FOUND', 'Không tìm thấy hồ sơ');
    if (req.actor?.role !== 'CAREGIVER' || patient.caregiverId !== req.actor.id) {
      throw new ApiError(403, 'FORBIDDEN', 'Không có quyền truy cập hồ sơ');
    }
    // Express restores route params before the app-level error handler runs.
    // Keep authorized scope on the request so failures still belong to this patient.
    if (req.auditContext?.patientId !== patient.id) {
      req.auditContext = { patientId: patient.id, targetType: 'Patient', targetId: patient.id };
    }
    return patient;
  };
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function getConfig(overrides = {}, ephemeral = false) {
  const dataDir = resolve(process.env.DATA_DIR || 'data');
  let jwtSecret = overrides.jwtSecret || process.env.JWT_SECRET;
  let tokenEncryptionKey = overrides.tokenEncryptionKey || process.env.TOKEN_ENCRYPTION_KEY;
  if (process.env.NODE_ENV === 'production' && (!jwtSecret || !tokenEncryptionKey)) {
    throw new Error('Production requires JWT_SECRET and TOKEN_ENCRYPTION_KEY');
  }
  if (!jwtSecret || !tokenEncryptionKey) {
    let keys;
    const filename = resolve(dataDir, 'local-keys.json');
    if (!ephemeral && existsSync(filename)) keys = JSON.parse(readFileSync(filename, 'utf8'));
    else {
      keys = { jwtSecret: randomBytes(48).toString('hex'), tokenEncryptionKey: randomBytes(32).toString('hex') };
      if (!ephemeral) {
        mkdirSync(dataDir, { recursive: true });
        writeFileSync(filename, JSON.stringify(keys), { mode: 0o600, flag: 'wx' });
      }
    }
    jwtSecret ||= keys.jwtSecret;
    tokenEncryptionKey ||= keys.tokenEncryptionKey;
  }
  if (jwtSecret.length < 32 || !/^[a-fA-F0-9]{64}$/.test(tokenEncryptionKey)) {
    throw new Error('JWT_SECRET needs >=32 characters; TOKEN_ENCRYPTION_KEY needs 64 hex characters');
  }
  const config = {
    host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 8080),
    baseUrl: process.env.BASE_URL || `http://127.0.0.1:${process.env.PORT || 8080}`,
    databasePath: process.env.DATABASE_PATH || resolve(dataDir, 'antam.sqlite'),
    reportDir: resolve(dataDir, 'reports'),
    fontPath: process.env.PDF_FONT_PATH || (existsSync('C:/Windows/Fonts/arial.ttf') ? 'C:/Windows/Fonts/arial.ttf' : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173').split(',').map(x => x.trim()),
    includeLateInRate: process.env.INCLUDE_LATE_IN_RATE === 'true', offlineMaxAgeHours: 72,
    // Built web app served on the same origin as the API (An Tâm v1.0 single-port mode).
    frontendDir: resolve(process.env.FRONTEND_DIST || fileURLToPath(new URL('../../frontend/dist', import.meta.url))),
    // Demo clock controls for local testing only; never available in production.
    devTools: process.env.ENABLE_DEV_TOOLS === 'true' && process.env.NODE_ENV !== 'production',
    dataDir,
    accessTokenSeconds: 900, refreshTokenDays: 30, deviceTokenDays: 90, pairingMinutes: 5,
    schedulerIntervalMs: 15000, logErrors: true,
    ...overrides, jwtSecret, tokenEncryptionKey,
  };
  if (!Number.isInteger(config.port) || config.port < 0 || config.port > 65535) throw new Error('Invalid PORT');
  return config;
}

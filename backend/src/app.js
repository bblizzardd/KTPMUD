import express from 'express';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { getConfig } from './config.js';
import { ApiError, newId, idSchema, parse } from './common.js';
import { buildSecurity, hashPassword } from './security.js';
import { registerAccountRoutes } from './accounts.js';
import { registerMedicationRoutes } from './medication.js';
import { registerClinicalRoutes } from './clinical.js';
import { seedCatalog } from './catalog.js';
import { createDevClock, registerDevRoutes } from './devtools.js';

export async function createApp(options = {}) {
  const config = getConfig(options.config, options.databasePath === ':memory:');
  const db = openDatabase(options.databasePath || config.databasePath);
  const devClock = !options.now && config.devTools ? createDevClock(config) : null;
  const ctx = { db, config, now: options.now || devClock?.now || (() => new Date()), events: new EventEmitter() };
  ctx.audit = ({ patientId = null, userId = null, actionType, targetType, targetId = null, status = 'SUCCESS', detail = '' }) => db.insert('auditLogs', {
    id: newId(), patientId, userId, actionType, targetType, targetId, status, detail, timestamp: ctx.now().toISOString(),
  });
  ctx.dummyPasswordHash = await hashPassword('unused-timing-equalizer');
  buildSecurity(ctx);
  seedCatalog(ctx);
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    const origin = req.get('origin');
    // Browsers also send Origin on same-origin POSTs when the web app is served by this server.
    if (origin && origin !== `${req.protocol}://${req.get('host')}`) {
      if (!config.corsOrigins.includes(origin)) throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origin không được phép');
      res.set('Access-Control-Allow-Origin', origin);
      res.vary('Origin');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });
  app.use(express.json({ limit: '128kb' }));
  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'antam-backend', time: ctx.now().toISOString(), devTools: Boolean(devClock) }));
  app.get('/openapi.yaml', (req, res) => res.type('application/yaml').sendFile(fileURLToPath(new URL('../../docs/api/openapi.yaml', import.meta.url))));
  const router = express.Router();
  for (const key of ['patientId', 'delegateId', 'deviceId', 'prescriptionId', 'doseId', 'reportId', 'appointmentId', 'alertId', 'confirmationId']) {
    router.param(key, (req, res, next, value) => { parse(idSchema, value); next(); });
  }
  registerAccountRoutes(router, ctx);
  registerMedicationRoutes(router, ctx);
  registerClinicalRoutes(router, ctx);
  if (devClock) registerDevRoutes(router, ctx, devClock);
  app.use('/api/v1', router);
  // Single-port mode: serve the built web app (hash routing, so index.html is enough).
  const frontendDir = config.frontendDir && path.resolve(config.frontendDir);
  if (frontendDir && existsSync(path.join(frontendDir, 'index.html'))) {
    app.use(express.static(frontendDir, { index: 'index.html', dotfiles: 'ignore' }));
  }
  app.use((req, res, next) => next(new ApiError(404, 'NOT_FOUND', 'Không tìm thấy API')));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error.status || 500;
    let code = error.code || 'INTERNAL_ERROR';
    let message = error.message;
    if (error.type === 'entity.parse.failed') { status = 400; code = 'INVALID_JSON'; message = 'JSON không hợp lệ'; }
    if (error.type === 'entity.too.large') { status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Yêu cầu quá lớn'; }
    if (error.code === 'ERR_SQLITE_ERROR' && /UNIQUE constraint/.test(error.message)) { status = 409; code = 'CONFLICT'; message = 'Dữ liệu đã tồn tại hoặc trạng thái bị xung đột'; }
    if (status >= 500) { if (config.logErrors) console.error(error); message = 'Lỗi xử lý trên máy chủ'; code = 'INTERNAL_ERROR'; }
    if (req.actor && !req.failureAudited && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // Only attach failure to a patient the caller actually controls.
      const context = req.auditContext;
      const candidate = context?.patientId || req.actor.patientId;
      const patient = candidate && db.get('patients', candidate);
      const patientId = patient && (req.actor.patientId === patient.id || patient.caregiverId === req.actor.id) ? patient.id : null;
      ctx.audit({
        patientId, userId: req.actor.id, actionType: `${req.method}_FAILED`,
        targetType: patientId && context?.targetType ? context.targetType : 'Request',
        targetId: patientId && context?.targetId ? context.targetId : null,
        status: 'FAILURE', detail: code,
      });
      req.failureAudited = true;
    }
    res.status(status).json({ code, message, ...(error.details ? { details: error.details } : {}) });
  });
  return { app, ctx, close: () => { ctx.events.removeAllListeners(); db.close(); } };
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { ApiError, parse } from './common.js';
import { tickMedication } from './medication.js';
import { tickClinical } from './clinical.js';

// Local demo/testing aid (ENABLE_DEV_TOOLS=true, never in production). The clock only
// moves forward so scheduled → pending → missed transitions and append-only history stay valid.
const MAX_ADVANCE_MINUTES = 14 * 24 * 60;

export function createDevClock(config) {
  const file = resolve(config.dataDir, 'dev-clock.json');
  let offsetMs = 0;
  try {
    if (existsSync(file)) offsetMs = Math.max(0, Number(JSON.parse(readFileSync(file, 'utf8')).offsetMs) || 0);
  } catch {
    offsetMs = 0;
  }
  return {
    now: () => new Date(Date.now() + offsetMs),
    get offsetMs() { return offsetMs; },
    advance(ms) {
      offsetMs += ms;
      mkdirSync(config.dataDir, { recursive: true });
      writeFileSync(file, JSON.stringify({ offsetMs }));
    },
  };
}

export function registerDevRoutes(router, ctx, clock) {
  const state = () => ({ now: ctx.now().toISOString(), offsetMs: clock.offsetMs });
  const input = z.object({
    advanceMinutes: z.number().int().min(1).max(MAX_ADVANCE_MINUTES).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  }).strict().refine((value) => (value.advanceMinutes === undefined) !== (value.to === undefined), 'Cần đúng một trong advanceMinutes hoặc to');

  router.get('/dev/clock', ctx.caregiver, (req, res) => res.json(state()));
  router.post('/dev/clock', ctx.caregiver, (req, res) => {
    const body = parse(input, req.body);
    const nowMs = +ctx.now();
    const target = body.to ? Date.parse(body.to) : nowMs + body.advanceMinutes * 60_000;
    const delta = target - nowMs;
    if (delta <= 0) throw new ApiError(422, 'CLOCK_BACKWARDS', 'Chỉ được tua thời gian về phía trước');
    if (delta > MAX_ADVANCE_MINUTES * 60_000) throw new ApiError(422, 'CLOCK_JUMP_TOO_LARGE', 'Mỗi lần tua tối đa 14 ngày');
    clock.advance(delta);
    ctx.audit({ userId: req.actor.id, actionType: 'DEV_CLOCK_ADVANCED', targetType: 'System', detail: `+${Math.round(delta / 60_000)} phút` });
    tickMedication(ctx);
    tickClinical(ctx).catch(() => {});
    res.json(state());
  });
}

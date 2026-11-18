import { z } from 'zod';
import { ApiError, parse } from './common.js';
import { tickMedication } from './medication.js';
import { tickClinical } from './clinical.js';

// Each local backend session starts at 06:00 Vietnam time. Skips only move forward
// within that session; restarting the clock does not reset persisted business data.
const MAX_ADVANCE_MINUTES = 14 * 24 * 60;

export function createDevClock(config, realNow = Date.now) {
  const startedAt = realNow();
  const date = new Date(startedAt + 7 * 60 * 60_000).toISOString().slice(0, 10);
  let offsetMs = Date.parse(`${date}T06:00:00+07:00`) - startedAt;
  return {
    now: () => new Date(realNow() + offsetMs),
    get offsetMs() { return offsetMs; },
    advance(ms) {
      offsetMs += ms;
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

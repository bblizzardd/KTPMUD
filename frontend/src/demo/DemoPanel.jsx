import { useEffect, useRef, useState } from 'react';
import { BellRing, Clock, FastForward, X } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { clock, notifyClockAdvance, syncClock } from '../app/clock.js';
import { useApp } from '../app/AppContext.jsx';
import { useNow, usePref } from '../app/hooks.js';
import { invalidateAll } from '../app/query.js';
import { addDays, fmtDateTime, fmtTime, toDateKey } from '../lib/time.js';
import { Spinner } from '../components/ui.jsx';

export default function DemoPanel() {
  const { patient, call, toast } = useApp();
  const [open, setOpen] = usePref('antam.v1.demoOpen', true);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const pending = useRef([]);
  const now = useNow(1_000);

  useEffect(() => () => { pending.current.length = 0; }, []);

  async function advance(target) {
    let body;
    if (typeof target === 'number') body = { advanceMinutes: target };
    else {
      if (!patient) return;
      const today = toDateKey(clock.now());
      const doses = await call(() => api.listDoses(patient.id, { from: today, to: addDays(today, 13) }));
      if (!doses.ok) return;
      const upcoming = doses.result.filter(d => ['SCHEDULED', 'PENDING'].includes(d.status));
      const field = target === 'NEXT' ? 'scheduledAt' : 'deadlineAt';
      const candidates = upcoming.filter(d => target !== 'NEXT' || Date.parse(d.scheduledAt) > clock.now());
      candidates.sort((a, b) => Date.parse(a[field]) - Date.parse(b[field]));
      const dose = candidates[0];
      if (!dose) {
        toast({ tone: 'info', title: 'Không có cữ phù hợp trong 14 ngày tới' });
        return;
      }
      body = { to: new Date(Math.max(clock.now() + 1000, Date.parse(dose[field]) + (target === 'NEXT' ? 1000 : 60_000))).toISOString() };
    }
    const result = await call(() => api.advanceDevClock(body), { errorTitle: 'Không tua được thời gian' });
    return result.ok ? result.result : null;
  }

  async function skip(target) {
    pending.current.push(target);
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      let last;
      while (pending.current.length) {
        const result = await advance(pending.current.shift());
        if (result) last = result;
        if (!pending.current.length && last) {
          notifyClockAdvance();
          await syncClock();
          invalidateAll();
        }
      }
      if (last) toast({ title: `Đã tua tới ${fmtTime(last.now)}` });
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  if (!clock.devTools()) return null;
  return <>
    <button type="button" className="demo-fab no-print" aria-expanded={open} onClick={() => setOpen(!open)}>
      <FastForward size={16} /> Mô phỏng thời gian · {fmtTime(now)}
    </button>
    {open && <div className="demo-panel no-print" role="dialog" aria-label="Mô phỏng thời gian">
      <div className="demo-panel-head">
        <strong style={{ flex: 1 }}>Mô phỏng thời gian</strong>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)} aria-label="Đóng mô phỏng thời gian"><X size={17} /></button>
      </div>
      <div className="demo-section">
        <div className="row" style={{ marginBottom: 12 }}><Clock size={18} /><strong className="num">{fmtDateTime(now)}</strong>{busy && <Spinner />}</div>
        <div className="demo-buttons">
          <button type="button" className="btn btn-primary" onClick={() => skip('OVERDUE')} disabled={busy || !patient}><FastForward size={16} /> Skip quá giờ</button>
          <button type="button" className="btn btn-secondary" onClick={() => skip('NEXT')} disabled={busy || !patient}><BellRing size={16} /> Tới cữ tiếp theo</button>
          <button type="button" className="btn btn-secondary" onClick={() => skip(15)}>+15 phút</button>
          <button type="button" className="btn btn-secondary" onClick={() => skip(60)}>+1 giờ</button>
        </div>
      </div>
    </div>}
  </>;
}

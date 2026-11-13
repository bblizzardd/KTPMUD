import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearAccountPhones } from '../device/phones.js';
import * as api from '../api/caregiver.js';
import { getSession, onSessionChange } from '../api/http.js';
import { isApiError, isNetworkError } from '../api/errors.js';
import { clearQueries, invalidate, useQuery } from './query.js';
import { usePref } from './hooks.js';

const AppContext = createContext(null);

/** Khóa bộ đệm của mọi dữ liệu thuộc một hồ sơ: làm mới cả nhóm sau thao tác ghi. */
export const patientKey = (patientId, suffix = '') => `p:${patientId}:${suffix}`;

export function AppProvider({ children }) {
  const [session, setSession] = useState(getSession);
  const sessionRef = useRef(session);
  const [toasts, setToasts] = useState([]);
  const [annotate, setAnnotate] = usePref('antam.v1.annotate', false);
  const [phoneOpen, setPhoneOpen] = usePref('antam.v1.phoneOpen', false);
  const [phoneId, setPhoneId] = usePref('antam.v1.phoneId', 'phone-1');
  const [selectedPatientId, setSelectedPatientId] = usePref('antam.v1.patient', null);
  // Máy chủ chỉ lưu bản băm của mã ghép nối nên mã chỉ hiển thị được ngay sau khi sinh.
  const [pairingCodes, setPairingCodes] = useState({});
  const toastSeq = useRef(0);

  useEffect(
    () =>
      onSessionChange((next) => {
        const previous = sessionRef.current;
        sessionRef.current = next;
        setSession(next);
        if (!next || previous?.accountId !== next.accountId || previous?.role !== next.role) {
          clearQueries();
          clearAccountPhones();
          setPairingCodes({});
        }
      }),
    []
  );

  const signedIn = Boolean(session);
  const meQ = useQuery('me', api.getMe, { enabled: signedIn });
  const patientsQ = useQuery('patients', api.listPatients, { enabled: signedIn && session.role !== 'PATIENT' });
  const caregiver = signedIn ? meQ.data || null : null;
  const patients = useMemo(() => [...(patientsQ.data || [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [patientsQ.data]);
  const patient = patients.find((p) => p.id === selectedPatientId) || patients[0] || null;

  const dismissToast = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    ({ tone = 'success', title, message = '', timeout } = {}) => {
      const id = ++toastSeq.current;
      setToasts((list) => [...list.slice(-3), { id, tone, title, message }]);
      const ms = timeout ?? (tone === 'danger' || tone === 'warning' ? 6500 : 4500);
      if (ms > 0) setTimeout(() => dismissToast(id), ms);
      return id;
    },
    [dismissToast]
  );

  /**
   * Gọi API, hiển thị lỗi thống nhất và làm mới dữ liệu liên quan.
   * Trả về Promise<{ ok, result, error }>.
   */
  const call = useCallback(
    async (fn, { success, errorTitle, silent = false, refresh } = {}) => {
      try {
        const result = await fn();
        if (refresh) invalidate(...[].concat(refresh));
        if (success) toast({ tone: 'success', title: typeof success === 'function' ? success(result) : success });
        return { ok: true, result };
      } catch (err) {
        if (refresh) invalidate(...[].concat(refresh));
        if (isApiError(err)) {
          if (err.status === 401 && !getSession()) {
            toast({ tone: 'warning', title: 'Phiên đăng nhập đã hết hạn', message: 'Vui lòng đăng nhập lại.' });
          } else if (!silent || isNetworkError(err) || err.status >= 500) {
            toast({ tone: err.status >= 500 || err.status === 0 ? 'danger' : 'warning', title: errorTitle || 'Không thực hiện được', message: err.message });
          }
          return { ok: false, error: err };
        }
        console.error(err);
        toast({ tone: 'danger', title: 'Lỗi không mong muốn', message: String(err?.message || err) });
        return { ok: false, error: err };
      }
    },
    [toast]
  );

  const logout = useCallback(() => {
    api.logout();
  }, []);

  const value = useMemo(
    () => ({
      session,
      caregiver,
      caregiverError: signedIn && !meQ.data ? meQ.error : null,
      reloadCaregiver: () => Promise.all([meQ.reload(), patientsQ.reload()]),
      logout,
      patients,
      patientsReady: patientsQ.data !== undefined,
      patient,
      selectPatient: setSelectedPatientId,
      toasts,
      toast,
      dismissToast,
      call,
      annotate,
      setAnnotate,
      phoneOpen,
      setPhoneOpen,
      phoneId,
      setPhoneId,
      pairingCodes,
      setPairingCodes
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, caregiver, meQ.error, patients, patientsQ.data, patient, toasts, annotate, phoneOpen, phoneId, pairingCodes]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp phải nằm trong AppProvider');
  return ctx;
}

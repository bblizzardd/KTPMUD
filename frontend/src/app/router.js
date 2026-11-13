import { useEffect, useState } from 'react';

// Router tối giản dựa trên hash (#/duong-dan?x=1) để tải lại trang vẫn giữ màn hình.

export const ROUTES = {
  login: '/dang-nhap',
  register: '/dang-ky',
  patient: '/benh-nhan',
  overview: '/tong-quan',
  doses: '/lich-cu-thuoc',
  prescriptions: '/don-thuoc',
  prescriptionNew: '/don-thuoc/moi',
  clinical: '/chi-so',
  reports: '/bao-cao',
  audit: '/nhat-ky',
  family: '/ho-so',
  device: '/thiet-bi'
};

export function parseHash(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = `/${pathPart.split('/').filter(Boolean).join('/')}`;
  const segments = path.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryPart));
  return { path, segments, query };
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash());
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function href(path, query) {
  const surface = typeof window !== 'undefined' ? parseHash().query.surface : null;
  if (surface === 'app' && query?.surface === undefined) query = { surface, ...query };
  const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString() : '';
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function navigate(path, query) {
  const target = href(path, query);
  if (window.location.hash === target) return;
  window.location.hash = target;
  window.scrollTo?.({ top: 0 });
}

export function replaceQuery(query) {
  const { path } = parseHash();
  const target = href(path, query);
  history.replaceState(null, '', target);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

import { useEffect } from 'react';
import { AppProvider, useApp } from './app/AppContext.jsx';
import { navigate, ROUTES, useRoute } from './app/router.js';
import { startClockSync } from './app/clock.js';
import AppShell from './shell/AppShell.jsx';
import AuthPage from './pages/AuthPage.jsx';
import NoPatientPage from './pages/NoPatientPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import DosesPage from './pages/DosesPage.jsx';
import PrescriptionsPage from './pages/PrescriptionsPage.jsx';
import PrescriptionEditorPage from './pages/PrescriptionEditorPage.jsx';
import PrescriptionDetailPage from './pages/PrescriptionDetailPage.jsx';
import ClinicalPage from './pages/ClinicalPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import ReportViewPage from './pages/ReportViewPage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import FamilyPage from './pages/FamilyPage.jsx';
import DeviceStandalone from './device/DeviceStandalone.jsx';
import { FullPageStatus } from './components/ui.jsx';

const TITLES = {
  [ROUTES.overview]: 'Tổng quan',
  [ROUTES.doses]: 'Lịch cữ thuốc',
  [ROUTES.prescriptions]: 'Đơn thuốc',
  [ROUTES.clinical]: 'Chỉ số & tái khám',
  [ROUTES.reports]: 'Báo cáo PDF',
  [ROUTES.audit]: 'Nhật ký thao tác',
  [ROUTES.family]: 'Hồ sơ & thiết bị',
  [ROUTES.device]: 'Ứng dụng điện thoại',
  [ROUTES.login]: 'Đăng nhập',
  [ROUTES.register]: 'Đăng ký'
};

function Redirect({ to }) {
  useEffect(() => navigate(to), [to]);
  return null;
}

function CaregiverRoutes({ route }) {
  const { patient } = useApp();
  if (!patient) return <NoPatientPage />;
  const [section, id, sub] = route.segments;
  switch (`/${section || ''}`) {
    case ROUTES.overview:
      return <OverviewPage key={patient.id} />;
    case ROUTES.doses:
      return <DosesPage key={patient.id} route={route} />;
    case ROUTES.prescriptions:
      if (!id) return <PrescriptionsPage key={patient.id} />;
      if (id === 'moi') return <PrescriptionEditorPage key={`${patient.id}-new`} />;
      if (sub === 'sua') return <PrescriptionEditorPage key={`${patient.id}-${id}`} prescriptionId={id} />;
      return <PrescriptionDetailPage key={`${patient.id}-${id}`} prescriptionId={id} />;
    case ROUTES.clinical:
      return <ClinicalPage key={patient.id} />;
    case ROUTES.reports:
      return id ? <ReportViewPage key={id} reportId={id} /> : <ReportsPage key={patient.id} />;
    case ROUTES.audit:
      return <AuditPage key={patient.id} />;
    case ROUTES.family:
      return <FamilyPage key={patient.id} />;
    default:
      return <Redirect to={ROUTES.overview} />;
  }
}

function Root() {
  const route = useRoute();
  const { session, caregiver, caregiverError, reloadCaregiver, patientsReady, logout } = useApp();

  useEffect(() => startClockSync(), []);

  useEffect(() => {
    const base = `/${route.segments[0] || ''}`;
    const title = TITLES[base] || TITLES[route.path];
    document.title = title ? `${title} · An Tâm` : 'An Tâm — Theo dõi điều trị ĐTĐ type 2';
  }, [route.path, route.segments]);

  if (route.segments[0] === 'thiet-bi') return <DeviceStandalone route={route} />;
  if (!session) return <AuthPage mode={route.path === ROUTES.register ? 'register' : 'login'} />;
  if (caregiverError) return <FullPageStatus error={caregiverError} onRetry={reloadCaregiver} onLogout={logout} />;
  if (!caregiver || !patientsReady) return <FullPageStatus />;
  if (route.path === '/' || route.path === ROUTES.login || route.path === ROUTES.register) return <Redirect to={ROUTES.overview} />;

  return (
    <AppShell route={route}>
      <CaregiverRoutes route={route} />
    </AppShell>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}

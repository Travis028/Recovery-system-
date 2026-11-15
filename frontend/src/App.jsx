import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Toaster } from '@/components/ui/toaster';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';
import RoleGuard from '@/components/RoleGuard';
import Loader from '@/components/Loader';
import ErrorBoundary from '@/components/ErrorBoundary';
import { SCREENS } from '@/lib/nav';

// Each screen is its own chunk, so a visitor downloads only the screens their role opens.
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const ReportFound = lazy(() => import('@/pages/ReportFound'));
const Documents = lazy(() => import('@/pages/Documents'));
const DocumentDetail = lazy(() => import('@/pages/DocumentDetail'));
const ReportLost = lazy(() => import('@/pages/ReportLost'));
const SearchDocuments = lazy(() => import('@/pages/SearchDocuments'));
const OwnerAlerts = lazy(() => import('@/pages/OwnerAlerts'));
const MatchReview = lazy(() => import('@/pages/MatchReview'));
const HandoverList = lazy(() => import('@/pages/HandoverList'));
const SecureHandover = lazy(() => import('@/pages/SecureHandover'));
const HandoverReceipt = lazy(() => import('@/pages/HandoverReceipt'));
const PickupPoints = lazy(() => import('@/pages/PickupPoints'));
const Statistics = lazy(() => import('@/pages/Statistics'));
const AuditTrail = lazy(() => import('@/pages/AuditTrail'));
const Users = lazy(() => import('@/pages/Users'));
const SystemSettings = lazy(() => import('@/pages/SystemSettings'));
const MyData = lazy(() => import('@/pages/MyData'));
const VerifyReceipt = lazy(() => import('@/pages/VerifyReceipt'));

// Every signed-in route checks the roles listed for its screen in lib/nav.js, the same list
// the menu is built from. The data layer checks again on every request.
function guarded(path, screen, element) {
  return <Route key={path} path={path} element={<RoleGuard allow={SCREENS[screen].roles}>{element}</RoleGuard>} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<Loader label="Opening the page" />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/verify-receipt/:handoverId" element={<VerifyReceipt />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              {guarded('/dashboard', 'dashboard', <Dashboard />)}
              {guarded('/report-found', 'reportFound', <ReportFound />)}
              {guarded('/documents', 'documents', <Documents />)}
              {guarded('/documents/:documentId', 'documents', <DocumentDetail />)}
              {guarded('/report-lost', 'reportLost', <ReportLost />)}
              {guarded('/search', 'search', <SearchDocuments />)}
              {guarded('/alerts', 'alerts', <OwnerAlerts />)}
              {guarded('/matches', 'matches', <MatchReview />)}
              {guarded('/handover', 'handover', <HandoverList />)}
              {guarded('/handover/:matchId', 'handover', <SecureHandover />)}
              {guarded('/receipt/:handoverId', 'receipt', <HandoverReceipt />)}
              {guarded('/pickup-points', 'pickupPoints', <PickupPoints />)}
              {guarded('/statistics', 'statistics', <Statistics />)}
              {guarded('/audit', 'audit', <AuditTrail />)}
              {guarded('/users', 'users', <Users />)}
              {guarded('/system', 'system', <SystemSettings />)}
              {guarded('/my-data', 'myData', <MyData />)}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <Toaster />
    </BrowserRouter>
  );
}

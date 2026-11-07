import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Toaster } from '@/components/ui/toaster';
import Login from '@/pages/Login';
import VerifyReceipt from '@/pages/VerifyReceipt';
import Dashboard from '@/pages/Dashboard';
import ReportFound from '@/pages/ReportFound';
import Documents from '@/pages/Documents';
import DocumentDetail from '@/pages/DocumentDetail';
import ReportLost from '@/pages/ReportLost';
import SearchDocuments from '@/pages/SearchDocuments';
import OwnerAlerts from '@/pages/OwnerAlerts';
import MatchReview from '@/pages/MatchReview';
import HandoverList from '@/pages/HandoverList';
import SecureHandover from '@/pages/SecureHandover';
import HandoverReceipt from '@/pages/HandoverReceipt';
import PickupPoints from '@/pages/PickupPoints';
import Statistics from '@/pages/Statistics';
import AuditTrail from '@/pages/AuditTrail';
import Users from '@/pages/Users';
import SystemSettings from '@/pages/SystemSettings';
import MyData from '@/pages/MyData';
import NotFound from '@/pages/NotFound';
import RoleGuard from '@/components/RoleGuard';
import { SCREENS } from '@/lib/nav';

// Every signed-in route checks the roles listed for its screen in lib/nav.js, the same list
// the menu is built from. The data layer checks again on every request.
function guarded(path, screen, element) {
  return <Route key={path} path={path} element={<RoleGuard allow={SCREENS[screen].roles}>{element}</RoleGuard>} />;
}

export default function App() {
  return (
    <BrowserRouter>
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
      <Toaster />
    </BrowserRouter>
  );
}

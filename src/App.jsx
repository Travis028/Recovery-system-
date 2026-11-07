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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verify-receipt/:handoverId" element={<VerifyReceipt />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/report-found" element={<ReportFound />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/documents/:documentId" element={<DocumentDetail />} />
          <Route path="/report-lost" element={<ReportLost />} />
          <Route path="/search" element={<SearchDocuments />} />
          <Route path="/alerts" element={<OwnerAlerts />} />
          <Route path="/matches" element={<MatchReview />} />
          <Route path="/handover" element={<HandoverList />} />
          <Route path="/handover/:matchId" element={<SecureHandover />} />
          <Route path="/receipt/:handoverId" element={<HandoverReceipt />} />
          <Route path="/pickup-points" element={<PickupPoints />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/users" element={<Users />} />
          <Route path="/system" element={<SystemSettings />} />
          <Route path="/my-data" element={<MyData />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

import useLdrsUser from '@/hooks/useLdrsUser';
import Loader from '@/components/Loader';
import OwnerDashboard from '@/components/dashboards/OwnerDashboard';
import FinderDashboard from '@/components/dashboards/FinderDashboard';
import OfficerDashboard from '@/components/dashboards/OfficerDashboard';
import AdminDashboard from '@/components/dashboards/AdminDashboard';

export default function Dashboard() {
  const { user, role } = useLdrsUser();
  if (!user) return <Loader label="Opening your dashboard" />;
  if (role === 'Admin') return <AdminDashboard user={user} />;
  if (role === 'Officer') return <OfficerDashboard user={user} />;
  if (role === 'Finder') return <FinderDashboard user={user} />;
  return <OwnerDashboard user={user} />;
}

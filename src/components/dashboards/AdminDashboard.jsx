import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BarChart3, Building2, ChevronRight, FolderOpen, Loader2, Scale, ShieldAlert, ShieldCheck, UserCog, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useResource from '@/hooks/useResource';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import ErrorState from '@/components/ErrorState';
import Loader from '@/components/Loader';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const LEVEL_TONES = { high: 'danger', medium: 'warning', low: 'neutral' };

export default function AdminDashboard({ user }) {
  const { toast } = useToast();
  const [chain, setChain] = useState(null);
  const { data, loading, error, reload } = useResource(
    function () {
      return Promise.all([
        base44.functions.invoke('statistics'),
        base44.functions.invoke('securityAlerts'),
        base44.entities.User.count({ ldrs_role: 'Officer', approved: false }),
        base44.entities.PickupPoint.count({ verified: false, active: true }),
        base44.entities.DataRequest.count({ status: 'Open' }),
      ]);
    },
    [user.id],
  );

  const checkChain = async function () {
    setChain({ checking: true });
    try {
      setChain(await base44.functions.invoke('verifyAuditChain'));
    } catch (checkError) {
      setChain(null);
      toast({ tone: 'danger', title: 'The audit trail could not be checked', description: checkError.message });
    }
  };

  const header = (
    <PageHeader
      title={'Welcome, ' + user.full_name}
      description="System totals, security alerts and the tasks waiting for an administrator."
      actions={
        <>
          <Button asChild>
            <Link to="/users">
              <UserCog aria-hidden="true" />
              Users and roles
            </Link>
          </Button>
          <Button variant="secondary" onClick={checkChain} disabled={Boolean(chain && chain.checking)}>
            {chain && chain.checking ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
            Check audit trail
          </Button>
        </>
      }
    />
  );

  if (loading && !data) return <>{header}<Loader label="Loading the administrator dashboard" /></>;
  if (error) return <>{header}<ErrorState title="The dashboard could not be loaded" error={error} onRetry={reload} /></>;

  const [stats, alerts, pendingOfficers, unverifiedPoints, openRequests] = data;
  const tasks = [
    { to: '/users', icon: UserCog, label: 'Officer accounts awaiting approval', value: pendingOfficers },
    { to: '/pickup-points', icon: Building2, label: 'Pickup points awaiting verification', value: unverifiedPoints },
    { to: '/system', icon: Scale, label: 'Open data protection requests', value: openRequests },
    { to: '/statistics', icon: BarChart3, label: 'Statistics and anonymised exports', value: null },
  ];

  return (
    <div>
      {header}
      <div className="space-y-section">
        {chain && !chain.checking ? (
          <Alert tone={chain.ok ? 'success' : 'danger'} title={chain.ok ? 'Audit trail intact' : 'Audit trail broken'}>
            {chain.ok ? chain.checked + ' linked entries verified.' : 'Entry ' + chain.brokenAt + ': ' + chain.reason}
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Documents registered" value={stats.found} icon={FolderOpen} tone="primary" />
          <StatCard label="Returned to owners" value={stats.returned} icon={ShieldCheck} tone="success" hint={stats.recovery_rate + '% recovery rate'} />
          <StatCard label="Open loss reports" value={stats.open_reports} icon={Users} tone="accent" />
          <StatCard label="Possible duplicates" value={stats.duplicates} icon={AlertTriangle} tone="warning" />
        </div>

        <div className="grid gap-section lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Security alerts, last 24 hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.length ? (
                <>
                  {alerts.map(function (alert) {
                    return (
                      <Alert key={alert.title} tone={LEVEL_TONES[alert.level]} title={alert.title}>
                        {alert.detail}
                      </Alert>
                    );
                  })}
                  <Button variant="link" size="sm" asChild>
                    <Link to="/audit">Open the audit trail</Link>
                  </Button>
                </>
              ) : (
                <Alert tone="success">No unusual activity detected.</Alert>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle>Waiting for you</CardTitle>
            </CardHeader>
            <ul className="divide-y divide-border border-t border-border">
              {tasks.map(function (item) {
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="flex items-center gap-3 px-card py-3.5 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span className="flex-1 font-medium">{item.label}</span>
                      {item.value !== null ? <Badge tone={item.value ? 'warning' : 'neutral'}>{item.value}</Badge> : null}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

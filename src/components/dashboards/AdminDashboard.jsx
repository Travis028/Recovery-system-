import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/StatCard';
import Loader from '@/components/Loader';
import { AlertTriangle, BarChart3, Building2, FolderOpen, ShieldAlert, ShieldCheck, UserCog, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const LEVEL_STYLES = {
  high: 'border-rose-200 bg-rose-50 text-rose-900',
  medium: 'border-amber-200 bg-amber-50 text-amber-900',
  low: 'border-slate-200 bg-slate-50 text-slate-800',
};

export default function AdminDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [pendingOfficers, setPendingOfficers] = useState(0);
  const [unverifiedPoints, setUnverifiedPoints] = useState(0);
  const [openRequests, setOpenRequests] = useState(0);
  const [chain, setChain] = useState(null);

  useEffect(function () {
    let active = true;
    const load = async function () {
      const [statistics, securityAlerts, officers, points, requests] = await Promise.all([
        base44.functions.invoke('statistics'),
        base44.functions.invoke('securityAlerts'),
        base44.entities.User.count({ ldrs_role: 'Officer', approved: false }),
        base44.entities.PickupPoint.count({ verified: false, active: true }),
        base44.entities.DataRequest.count({ status: 'Open' }),
      ]);
      if (!active) return;
      setStats(statistics);
      setAlerts(securityAlerts);
      setPendingOfficers(officers);
      setUnverifiedPoints(points);
      setOpenRequests(requests);
      setLoading(false);
    };
    load();
    return function () { active = false; };
  }, [user.id]);

  if (loading) return <Loader label="Loading the administrator dashboard" />;

  const checkChain = async function () {
    setChain({ checking: true });
    setChain(await base44.functions.invoke('verifyAuditChain'));
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-violet-800 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Administrator dashboard</p>
        <h1 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">Welcome, {user.full_name}</h1>
        <p className="mt-2 max-w-xl text-sm text-blue-100">System totals, security alerts and the tasks waiting for an administrator.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button className="gap-2 rounded-xl bg-white text-blue-900 hover:bg-blue-50" asChild>
            <Link to="/users"><UserCog className="h-4 w-4" />Users and roles</Link>
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl border-white/40 bg-transparent text-white hover:bg-white/10" onClick={checkChain}>
            <ShieldCheck className="h-4 w-4" />Check audit trail integrity
          </Button>
        </div>
        {chain && !chain.checking ? (
          <p className={cn('mt-4 inline-block rounded-xl px-3 py-2 text-sm', chain.ok ? 'bg-emerald-500/20 text-emerald-50' : 'bg-rose-500/30 text-rose-50')}>
            {chain.ok ? 'Audit trail intact — ' + chain.checked + ' linked entries verified.' : 'Audit trail BROKEN at entry ' + chain.brokenAt + ': ' + chain.reason}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Documents registered" value={stats.found} icon={FolderOpen} tone="blue" />
        <StatCard label="Returned to owners" value={stats.returned} icon={ShieldCheck} tone="emerald" hint={stats.recovery_rate + '% recovery rate'} />
        <StatCard label="Open loss reports" value={stats.open_reports} icon={Users} tone="violet" />
        <StatCard label="Possible duplicates" value={stats.duplicates} icon={AlertTriangle} tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-slate-900">
            <ShieldAlert className="h-5 w-5" /> Security alerts (last 24 hours)
          </h2>
          {alerts.length ? (
            <div className="space-y-3">
              {alerts.map(function (alert, index) {
                return (
                  <div key={index} className={cn('rounded-2xl border p-4', LEVEL_STYLES[alert.level])}>
                    <p className="text-xs font-semibold uppercase tracking-wide">{alert.level} priority</p>
                    <p className="mt-1 font-heading text-sm font-semibold">{alert.title}</p>
                    <p className="mt-1 text-xs opacity-90">{alert.detail}</p>
                  </div>
                );
              })}
              <Link to="/audit" className="inline-block text-sm font-semibold text-blue-900 underline">Open the audit trail</Link>
            </div>
          ) : (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">No unusual activity detected.</p>
          )}
        </section>
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold text-slate-900">Waiting for you</h2>
          <div className="space-y-3">
            {[
              { to: '/users', icon: UserCog, label: 'Officer accounts awaiting approval', value: pendingOfficers },
              { to: '/pickup-points', icon: Building2, label: 'Pickup points awaiting verification', value: unverifiedPoints },
              { to: '/system', icon: Users, label: 'Open data protection requests', value: openRequests },
              { to: '/statistics', icon: BarChart3, label: 'Statistics and anonymised exports', value: null },
            ].map(function (item) {
              return (
                <Link key={item.to + item.label} to={item.to} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300">
                  <span className="flex items-center gap-3 text-sm font-medium text-slate-700">
                    <item.icon className="h-5 w-5 text-blue-800" />
                    {item.label}
                  </span>
                  {item.value !== null ? (
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', item.value ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600')}>{item.value}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

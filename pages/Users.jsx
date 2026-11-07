import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import Loader from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_LABELS, formatDate, maskPhone, resolveRole } from '@/lib/ldrs';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit';
import { useToast } from '@/components/ui/use-toast';
import { Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

function UsersContent() {
  const { user: me } = useLdrsUser();
  const { toast } = useToast();
  const [users, setUsers] = useState(null);
  const [points, setPoints] = useState([]);
  const [filter, setFilter] = useState('all');

  const load = async function () {
    const [list, pointList] = await Promise.all([base44.entities.User.list('-created_date'), base44.entities.PickupPoint.list('name')]);
    setUsers(list);
    setPoints(pointList);
  };
  useEffect(function () { load(); }, []);
  if (!users) return <Loader label="Loading accounts" />;

  const change = async function (target, changes, description) {
    try {
      await base44.entities.User.update(target.id, changes);
      await logAction({ action: AUDIT_ACTIONS.USER_CHANGE, details: description + ' — ' + target.email, user: me });
      toast({ title: 'Account updated', description: description });
      load();
    } catch (error) {
      toast({ title: 'Could not update the account', description: error.message, variant: 'destructive' });
    }
  };

  const pointName = function (id) {
    const p = points.find(function (x) { return x.id === id; });
    return p ? p.name : 'No station';
  };

  const visible = users.filter(function (u) {
    const role = resolveRole(u);
    if (filter === 'pending') return role === 'Officer' && !u.approved;
    if (filter === 'locked') return u.locked_until && new Date(u.locked_until).getTime() > Date.now();
    return filter === 'all' || role === filter;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[['all', 'All'], ['pending', 'Officers awaiting approval'], ['locked', 'Locked'], ['Officer', 'Officers'], ['Owner', 'Owners'], ['Finder', 'Finders'], ['Admin', 'Admins']].map(function (f) {
          return (
            <button key={f[0]} type="button" onClick={function () { setFilter(f[0]); }} className={cn('rounded-full px-3.5 py-1.5 text-xs font-semibold', filter === f[0] ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {f[1]}
            </button>
          );
        })}
      </div>
      <div className="space-y-3">
        {visible.map(function (u) {
          const role = resolveRole(u);
          const locked = u.locked_until && new Date(u.locked_until).getTime() > Date.now();
          const self = u.id === me.id;
          return (
            <div key={u.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-sm font-semibold text-slate-900">{u.full_name}{self ? ' (you)' : ''}</p>
                  <p className="text-xs text-slate-500">{u.email} · {u.phone ? maskPhone(u.phone) + (u.phone_verified ? ' verified' : ' not verified') : 'no phone'} · joined {formatDate(u.created_date)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">{ROLE_LABELS[role] || 'No role'}</span>
                  {role === 'Officer' ? (
                    <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', u.approved ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
                      {u.approved ? 'Approved' : 'Awaiting approval'}
                    </span>
                  ) : null}
                  {locked ? <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"><Lock className="h-3 w-3" />Locked</span> : null}
                  {u.disabled ? <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Disabled</span> : null}
                </div>
              </div>
              {!self ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {role === 'Officer' ? (
                    <>
                      <div className="w-64">
                        <Select value={u.pickup_point_id || ''} onValueChange={function (v) { change(u, { pickup_point_id: v }, 'Station set to ' + pointName(v)); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assign a station" /></SelectTrigger>
                          <SelectContent>{points.filter(function (p) { return p.verified && p.active; }).map(function (p) { return <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>; })}</SelectContent>
                        </Select>
                      </div>
                      {u.approved ? (
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={function () { change(u, { approved: false }, 'Officer approval withdrawn'); }}>Withdraw approval</Button>
                      ) : (
                        <Button size="sm" className="gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700" disabled={!u.pickup_point_id || !u.phone} onClick={function () { change(u, { approved: true, phone_verified: true }, 'Officer approved for ' + pointName(u.pickup_point_id) + ' (identity and phone confirmed with the station)'); }}>
                          <ShieldCheck className="h-3.5 w-3.5" />Approve officer
                        </Button>
                      )}
                    </>
                  ) : null}
                  {locked ? <Button size="sm" variant="outline" className="rounded-lg" onClick={function () { change(u, { locked_until: '', failed_logins: 0 }, 'Account unlocked'); }}>Unlock</Button> : null}
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={function () { change(u, { disabled: !u.disabled }, u.disabled ? 'Account enabled' : 'Account disabled'); }}>
                    {u.disabled ? 'Enable account' : 'Disable account'}
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Users() {
  return (
    <RoleGuard allow={['Admin']}>
      <PageHeader title="Users and roles" description="Approve officers, assign them to one station, and unlock or disable accounts. Every change is logged." />
      <UsersContent />
    </RoleGuard>
  );
}

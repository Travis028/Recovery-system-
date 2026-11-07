import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import Loader from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateTime } from '@/lib/ldrs';
import { downloadText } from '@/lib/utils';
import { Download, Link2, Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { cn } from '@/lib/utils';

function AuditContent() {
  const [entries, setEntries] = useState(null);
  const [action, setAction] = useState('all');
  const [query, setQuery] = useState('');
  const [chain, setChain] = useState(null);
  const [checking, setChecking] = useState(false);
  const [limit, setLimit] = useState(100);

  const load = async function () {
    setEntries(await base44.entities.AuditLog.list('-seq'));
  };
  useEffect(function () { load(); }, []);
  if (!entries) return <Loader label="Loading the audit trail" />;

  const actions = [...new Set(entries.map(function (e) { return e.action; }))].sort();
  const term = query.trim().toLowerCase();
  const visible = entries.filter(function (e) {
    if (action !== 'all' && e.action !== action) return false;
    return !term || (e.details + ' ' + e.action + ' ' + (e.actor_role || '')).toLowerCase().indexOf(term) >= 0;
  });

  const verify = async function () {
    setChecking(true);
    setChain(await base44.functions.invoke('verifyAuditChain'));
    setChecking(false);
    load();
  };

  const exportCsv = function () {
    const rows = [['seq', 'time', 'role', 'user_id', 'action', 'details', 'hash']].concat(
      visible.map(function (e) { return [e.seq, e.created_date, e.actor_role, e.user_id || '', e.action, e.details, e.hash]; }),
    );
    downloadText('ldrs-audit-' + new Date().toISOString().slice(0, 10) + '.csv', rows.map(function (r) {
      return r.map(function (c) { const t = String(c); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(',');
    }).join('\n'), 'text/csv');
    base44.entities.AuditLog.create({ action: 'Data export', details: 'Audit trail exported (' + visible.length + ' entries)' });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <Link2 className="h-5 w-5 text-blue-800" />
        <p className="flex-1 text-sm text-slate-600">
          Entries can only be added. Each one carries the fingerprint of the one before it, so any change or deletion breaks the chain.
        </p>
        <Button variant="outline" className="gap-2 rounded-xl" onClick={exportCsv}><Download className="h-4 w-4" />Export view</Button>
        <Button className="gap-2 rounded-xl bg-blue-900 hover:bg-blue-950" onClick={verify} disabled={checking}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Verify chain
        </Button>
      </div>
      {chain ? (
        <p className={cn('flex items-center gap-2 rounded-2xl border p-4 text-sm', chain.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900')}>
          {chain.ok ? <ShieldCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
          {chain.ok ? 'Chain intact: ' + chain.checked + ' entries verified.' : 'Tampering detected at entry #' + chain.brokenAt + ': ' + chain.reason}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map(function (a) { return <SelectItem key={a} value={a}>{a}</SelectItem>; })}
          </SelectContent>
        </Select>
        <Input value={query} placeholder="Search details" onChange={function (e) { setQuery(e.target.value); }} />
      </div>
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Details</th><th className="px-4 py-3">Hash</th></tr>
          </thead>
          <tbody>
            {visible.slice(0, limit).map(function (e) {
              return (
                <tr key={e.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-2.5 text-slate-500">{e.seq}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{formatDateTime(e.created_date)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{e.actor_role}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{e.action}</td>
                  <td className="px-4 py-2.5 text-slate-600">{e.details}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">{String(e.hash).slice(0, 10)}…</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visible.length > limit ? <Button variant="outline" className="rounded-xl" onClick={function () { setLimit(limit + 100); }}>Show more</Button> : null}
    </div>
  );
}

export default function AuditTrail() {
  return (
    <RoleGuard allow={['Admin']}>
      <PageHeader title="Audit trail" description="Every important action, who did it and when. Read-only and kept apart from the main records." />
      <AuditContent />
    </RoleGuard>
  );
}

import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import Loader from '@/components/Loader';
import StatCard from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { documentTypeLabel } from '@/lib/ldrs';
import { downloadText } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Archive, CheckCircle2, Download, FolderOpen, Gauge, ScanText, Timer } from 'lucide-react';

// Two-series palette validated for colour-blind separation and contrast (dataviz validator).
const FOUND = '#0284c7';
const RETURNED = '#d97706';

function MonthlyChart({ months }) {
  const [hover, setHover] = useState(null);
  const peak = Math.max(...months.map(function (m) { return Math.max(m.found, m.returned); }));
  const max = Math.max(2, Math.ceil(peak / 2) * 2); // even, so the middle tick is a whole number
  const ticks = [max, max / 2, 0];

  return (
    <div role="img" aria-label="Documents found and returned per month">
      <div className="flex gap-3">
        <div className="flex h-48 flex-col justify-between pb-0 text-right text-[11px] text-slate-500">
          {ticks.map(function (t) { return <span key={t}>{t}</span>; })}
        </div>
        <div className="relative h-48 flex-1 border-b border-slate-200">
          {ticks.map(function (t) {
            return <div key={t} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: (t / max) * 100 + '%' }} />;
          })}
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: 'repeat(' + months.length + ', minmax(0, 1fr))' }}>
            {months.map(function (m, i) {
              return (
                <div
                  key={m.key}
                  className={'relative flex items-end justify-center gap-0.5 rounded-t-lg ' + (hover === i ? 'bg-slate-50' : '')}
                  onMouseEnter={function () { setHover(i); }}
                  onMouseLeave={function () { setHover(null); }}
                >
                  <div className="w-4 rounded-t sm:w-6" style={{ height: (m.found / max) * 100 + '%', background: FOUND }} />
                  <div className="w-4 rounded-t sm:w-6" style={{ height: (m.returned / max) * 100 + '%', background: RETURNED }} />
                  {hover === i ? (
                    <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                      <p className="font-semibold text-slate-900">{m.label}</p>
                      <p className="text-slate-600">Found: {m.found}</p>
                      <p className="text-slate-600">Returned: {m.returned}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="ml-7 grid text-center text-xs text-slate-600" style={{ gridTemplateColumns: 'repeat(' + months.length + ', minmax(0, 1fr))' }}>
        {months.map(function (m) { return <span key={m.key} className="pt-1.5">{m.label}</span>; })}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: FOUND }} />Found</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: RETURNED }} />Returned</span>
      </div>
    </div>
  );
}

function StatisticsContent() {
  const { user, role } = useLdrsUser();
  const { toast } = useToast();
  const [stats, setStats] = useState(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(function () { base44.functions.invoke('statistics').then(setStats); }, [user.id]);
  if (!stats) return <Loader label="Calculating totals" />;

  const exportCsv = async function () {
    try {
      const file = await base44.functions.invoke('exportAnonymised');
      downloadText(file.filename, file.csv, 'text/csv;charset=utf-8');
      toast({ title: 'Export downloaded', description: 'Anonymised: no names, numbers or phone numbers. The export was logged.' });
    } catch (error) {
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
    }
  };

  const types = Object.keys(stats.by_type).sort(function (a, b) { return stats.by_type[b] - stats.by_type[a]; });
  const stations = Object.keys(stats.by_station);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Scope: <span className="font-semibold text-slate-700">{stats.scope}</span> · totals only, no personal details</p>
        {role === 'Admin' ? (
          <Button variant="outline" className="gap-2 rounded-xl" onClick={exportCsv}><Download className="h-4 w-4" />Anonymised CSV export</Button>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Found" value={stats.found} icon={FolderOpen} tone="blue" />
        <StatCard label="Matched" value={stats.matched} icon={CheckCircle2} tone="violet" />
        <StatCard label="Returned" value={stats.returned} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Recovery rate" value={stats.recovery_rate + '%'} icon={Gauge} tone="indigo" hint="Returned ÷ found" />
        <StatCard label="Average time to recovery" value={stats.avg_days_to_recovery === null ? null : stats.avg_days_to_recovery + (stats.avg_days_to_recovery === 1 ? ' day' : ' days')} icon={Timer} tone="amber" />
        <StatCard label="OCR accuracy" value={stats.ocr_accuracy === null ? null : stats.ocr_accuracy + '%'} icon={ScanText} tone="slate" hint={'Fields accepted unchanged, ' + stats.ocr_documents + ' document(s) read'} />
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-base font-semibold text-slate-900">Found and returned, last six months</h2>
          <button type="button" className="text-xs font-semibold text-blue-900 underline" onClick={function () { setShowTable(!showTable); }}>
            {showTable ? 'Show chart' : 'Show as table'}
          </button>
        </div>
        {showTable ? (
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">Month</th><th>Found</th><th>Returned</th></tr></thead>
            <tbody>{stats.months.map(function (m) { return <tr key={m.key} className="border-t border-slate-100"><td className="py-1.5">{m.label}</td><td>{m.found}</td><td>{m.returned}</td></tr>; })}</tbody>
          </table>
        ) : (
          <div className="mt-3"><MonthlyChart months={stats.months} /></div>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-heading text-base font-semibold text-slate-900">By document type</h2>
          <div className="mt-3 space-y-2">
            {types.map(function (type) {
              const pct = Math.round((stats.by_type[type] / Math.max(1, stats.found)) * 100);
              return (
                <div key={type}>
                  <div className="flex justify-between text-xs text-slate-600"><span>{documentTypeLabel(type)}</span><span>{stats.by_type[type]}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: pct + '%', background: FOUND }} /></div>
                </div>
              );
            })}
          </div>
        </div>
        {stations.length ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-heading text-base font-semibold text-slate-900">By pickup point</h2>
            <table className="mt-3 w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">Pickup point</th><th>Found</th><th>Returned</th></tr></thead>
              <tbody>{stations.map(function (name) { return <tr key={name} className="border-t border-slate-100"><td className="py-1.5">{name}</td><td>{stats.by_station[name].found}</td><td>{stats.by_station[name].returned}</td></tr>; })}</tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900"><Archive className="h-4 w-4" />Unclaimed and duplicates</h2>
            <p className="mt-2 text-sm text-slate-600">{stats.unclaimed} unclaimed · {stats.duplicates} flagged as possible duplicates</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Statistics() {
  const { user } = useLdrsUser();
  return (
    <RoleGuard allow={['Officer', 'Admin']}>
      <PageHeader title="Statistics" description="Totals and trends. Exports are anonymised, administrator-only and logged." />
      {user ? <StatisticsContent /> : null}
    </RoleGuard>
  );
}

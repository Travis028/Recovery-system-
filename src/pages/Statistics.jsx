import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import Loader from '@/components/Loader';
import ErrorState from '@/components/ErrorState';
import useResource from '@/hooks/useResource';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatCard from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { documentTypeLabel } from '@/lib/ldrs';
import { downloadText } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Archive, CheckCircle2, Download, FolderOpen, Gauge, ScanText, Timer } from 'lucide-react';

// Series colours come from --chart-1 and --chart-2, checked for colour-blind separation
// and contrast against the card surface in both themes.
const SERIES = [
  { key: 'found', label: 'Found', className: 'bg-chart-1' },
  { key: 'returned', label: 'Returned', className: 'bg-chart-2' },
];

function MonthlyChart({ months }) {
  const [hover, setHover] = useState(null);
  const peak = Math.max(...months.map((m) => Math.max(m.found, m.returned)));
  const max = Math.max(2, Math.ceil(peak / 2) * 2); // even, so the middle tick is a whole number
  const ticks = [max, max / 2, 0];
  const columns = { gridTemplateColumns: 'repeat(' + months.length + ', minmax(0, 1fr))' };

  return (
    <figure aria-label="Documents found and returned per month, last six months">
      <div className="flex gap-3" aria-hidden="true">
        <div className="flex h-48 flex-col justify-between text-right text-xs tabular-nums text-muted-foreground">
          {ticks.map((t) => <span key={t}>{t}</span>)}
        </div>
        <div className="relative h-48 flex-1 border-b border-border-strong">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-chart-grid" style={{ bottom: (t / max) * 100 + '%' }} />
          ))}
          <div className="absolute inset-0 grid" style={columns}>
            {months.map(function (m, i) {
              return (
                <div
                  key={m.key}
                  className={'relative flex items-end justify-center gap-0.5 rounded-t-md ' + (hover === i ? 'bg-muted/60' : '')}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {SERIES.map((series) => (
                    <div key={series.key} className={'w-4 rounded-t sm:w-6 ' + series.className} style={{ height: (m[series.key] / max) * 100 + '%' }} />
                  ))}
                  {hover === i ? (
                    <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                      <p className="font-semibold">{m.label}</p>
                      {SERIES.map((series) => (
                        <p key={series.key} className="text-muted-foreground">
                          {series.label}: <span className="tabular-nums text-foreground">{m[series.key]}</span>
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="ml-7 grid text-center text-xs text-muted-foreground" style={columns} aria-hidden="true">
        {months.map((m) => <span key={m.key} className="pt-1.5">{m.label}</span>)}
      </div>
      <figcaption className="mt-3 flex gap-4 text-xs text-muted-foreground">
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5">
            <span className={'h-2.5 w-2.5 rounded-sm ' + series.className} />
            {series.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function MonthTable({ months }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Documents found and returned per month</caption>
      <thead>
        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <th scope="col" className="py-2 font-medium">Month</th>
          <th scope="col" className="py-2 text-right font-medium">Found</th>
          <th scope="col" className="py-2 text-right font-medium">Returned</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {months.map((m) => (
          <tr key={m.key}>
            <th scope="row" className="py-2 text-left font-normal">{m.label}</th>
            <td className="py-2 text-right tabular-nums">{m.found}</td>
            <td className="py-2 text-right tabular-nums">{m.returned}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatisticsContent() {
  const { user, role } = useLdrsUser();
  const { toast } = useToast();
  const [showTable, setShowTable] = useState(false);
  const { data: stats, loading, error, reload } = useResource(() => base44.functions.invoke('statistics'), [user.id]);

  if (loading && !stats) return <Loader label="Calculating totals" />;
  if (error) return <ErrorState title="Statistics could not be calculated" error={error} onRetry={reload} />;

  const exportCsv = async function () {
    try {
      const file = await base44.functions.invoke('exportAnonymised');
      downloadText(file.filename, file.csv, 'text/csv;charset=utf-8');
      toast({ tone: 'success', title: 'Export downloaded', description: 'No names, numbers or phone numbers are included. The export was logged.' });
    } catch (exportError) {
      toast({ tone: 'danger', title: 'Export failed', description: exportError.message });
    }
  };

  const types = Object.keys(stats.by_type).sort((a, b) => stats.by_type[b] - stats.by_type[a]);
  const stations = Object.keys(stats.by_station);

  return (
    <div className="space-y-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Scope: <span className="font-medium text-foreground">{stats.scope}</span> · totals only, no personal details
        </p>
        {role === 'Admin' ? (
          <Button variant="secondary" onClick={exportCsv}>
            <Download aria-hidden="true" />
            Anonymised CSV export
          </Button>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Found" value={stats.found} icon={FolderOpen} tone="primary" />
        <StatCard label="Matched" value={stats.matched} icon={CheckCircle2} tone="accent" />
        <StatCard label="Returned" value={stats.returned} icon={CheckCircle2} tone="success" />
        <StatCard label="Recovery rate" value={stats.recovery_rate + '%'} icon={Gauge} tone="info" hint="Returned as a share of found" />
        <StatCard
          label="Average time to recovery"
          value={stats.avg_days_to_recovery === null ? null : stats.avg_days_to_recovery + (stats.avg_days_to_recovery === 1 ? ' day' : ' days')}
          icon={Timer}
          tone="warning"
        />
        <StatCard
          label="OCR accuracy"
          value={stats.ocr_accuracy === null ? null : stats.ocr_accuracy + '%'}
          icon={ScanText}
          tone="neutral"
          hint={'Fields accepted unchanged, ' + stats.ocr_documents + ' document(s) read'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Found and returned, last six months</CardTitle>
          <Button variant="link" size="sm" onClick={() => setShowTable(!showTable)} aria-pressed={showTable}>
            {showTable ? 'Show chart' : 'Show as table'}
          </Button>
        </CardHeader>
        <CardContent>{showTable ? <MonthTable months={stats.months} /> : <MonthlyChart months={stats.months} />}</CardContent>
      </Card>

      <div className="grid gap-section lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By document type</CardTitle>
          </CardHeader>
          <CardContent>
            {types.length ? (
              <ul className="space-y-3">
                {types.map(function (type) {
                  const pct = Math.round((stats.by_type[type] / Math.max(1, stats.found)) * 100);
                  return (
                    <li key={type}>
                      <div className="flex justify-between text-sm">
                        <span>{documentTypeLabel(type)}</span>
                        <span className="tabular-nums text-muted-foreground">{stats.by_type[type]}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden="true">
                        <div className="h-2 rounded-full bg-chart-1" style={{ width: pct + '%' }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No documents registered yet.</p>
            )}
          </CardContent>
        </Card>
        {stations.length ? (
          <Card>
            <CardHeader>
              <CardTitle>By pickup point</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <caption className="sr-only">Documents by pickup point</caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 font-medium">Pickup point</th>
                    <th scope="col" className="py-2 text-right font-medium">Found</th>
                    <th scope="col" className="py-2 text-right font-medium">Returned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stations.map((name) => (
                    <tr key={name}>
                      <th scope="row" className="py-2 text-left font-normal">{name}</th>
                      <td className="py-2 text-right tabular-nums">{stats.by_station[name].found}</td>
                      <td className="py-2 text-right tabular-nums">{stats.by_station[name].returned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Unclaimed and duplicates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {stats.unclaimed} unclaimed · {stats.duplicates} flagged as possible duplicates
              </p>
            </CardContent>
          </Card>
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

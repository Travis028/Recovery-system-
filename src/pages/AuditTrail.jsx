import { useState } from 'react';
import { Download, Link2, Loader2, ScrollText, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useResource from '@/hooks/useResource';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import DataTable from '@/components/data-table/DataTable';
import { SkeletonRows } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateTime } from '@/lib/ldrs';
import { downloadText } from '@/lib/utils';

const ALERT_ACTIONS = ['Failed login', 'Failed two-step login', 'Account locked', 'Login blocked', 'Collection code rejected', 'Search rate limit reached', 'Rapid uploads flagged'];

function AuditContent({ chain }) {
  const [action, setAction] = useState('all');
  // Verifying the chain writes an entry of its own, so the list reloads after each check.
  const { data: entries, loading, error, reload } = useResource(
    function () {
      return base44.entities.AuditLog.list('-seq');
    },
    [chain],
  );

  if (loading && !entries) return <SkeletonRows rows={8} label="Loading the audit trail" />;
  if (error) return <ErrorState title="The audit trail could not be loaded" error={error} onRetry={reload} />;
  if (!entries.length) return <EmptyState icon={ScrollText} title="No entries yet" />;

  const actions = [...new Set(entries.map((entry) => entry.action))].sort();
  const rows = action === 'all' ? entries : entries.filter((entry) => entry.action === action);

  const exportCsv = function () {
    const table = [['seq', 'time', 'role', 'user_id', 'action', 'details', 'hash']].concat(
      rows.map(function (entry) {
        return [entry.seq, entry.created_date, entry.actor_role, entry.user_id || '', entry.action, entry.details, entry.hash];
      }),
    );
    downloadText(
      'ldrs-audit-' + new Date().toISOString().slice(0, 10) + '.csv',
      table
        .map(function (row) {
          return row
            .map(function (cell) {
              const text = String(cell);
              return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
            })
            .join(',');
        })
        .join('\n'),
      'text/csv',
    );
    base44.entities.AuditLog.create({ action: 'Data export', details: 'Audit trail exported (' + rows.length + ' entries)' });
  };

  const columns = [
    { key: 'seq', header: '#', sortValue: (entry) => entry.seq, cell: (entry) => <span className="tabular-nums text-muted-foreground">{entry.seq}</span> },
    { key: 'time', header: 'Time', sortValue: (entry) => entry.created_date, cell: (entry) => <span className="whitespace-nowrap">{formatDateTime(entry.created_date)}</span> },
    { key: 'role', header: 'Role', sortValue: (entry) => entry.actor_role, cell: (entry) => <span className="text-muted-foreground">{entry.actor_role}</span> },
    {
      key: 'action',
      header: 'Action',
      sortValue: (entry) => entry.action,
      cell: function (entry) {
        return ALERT_ACTIONS.indexOf(entry.action) >= 0 ? <Badge tone="danger">{entry.action}</Badge> : <span className="whitespace-nowrap font-medium">{entry.action}</span>;
      },
    },
    { key: 'details', header: 'Details', cell: (entry) => <span className="block min-w-[16rem] text-muted-foreground">{entry.details}</span> },
    {
      key: 'hash',
      header: 'Hash',
      cell: (entry) => (
        <span className="font-mono text-xs text-muted-foreground" title={entry.hash}>
          {String(entry.hash).slice(0, 10)}…
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-section">
      {chain ? (
        <Alert tone={chain.ok ? 'success' : 'danger'} title={chain.ok ? 'Chain intact' : 'Tampering detected'}>
          {chain.ok ? chain.checked + ' entries verified.' : 'Entry #' + chain.brokenAt + ': ' + chain.reason}
        </Alert>
      ) : null}
      <DataTable
        caption="Audit trail entries"
        columns={columns}
        rows={rows}
        rowKey={(entry) => entry.id}
        pageSize={25}
        initialSort={{ key: 'seq', direction: 'desc' }}
        search={{ label: 'Search the audit trail', placeholder: 'Search details, actions or roles', text: (entry) => entry.details + ' ' + entry.action + ' ' + (entry.actor_role || '') }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-56" aria-label="Filter by action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map(function (item) {
                  return (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={exportCsv}>
              <Download aria-hidden="true" />
              Export view
            </Button>
          </div>
        }
      />
    </div>
  );
}

export default function AuditTrail() {
  const [chain, setChain] = useState(null);
  const [checking, setChecking] = useState(false);

  const verify = async function () {
    setChecking(true);
    setChain(await base44.functions.invoke('verifyAuditChain'));
    setChecking(false);
  };

  return (
    <RoleGuard allow={['Admin']}>
      <PageHeader
        title="Audit trail"
        description="Every important action, who did it and when. Entries can only be added, and each carries the fingerprint of the one before it."
        actions={
          <Button onClick={verify} disabled={checking}>
            {checking ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
            Verify chain
          </Button>
        }
      />
      <p className="-mt-3 mb-section flex items-center gap-2 text-sm text-muted-foreground">
        <Link2 className="h-4 w-4" aria-hidden="true" />
        Changing or deleting any entry breaks the chain and shows up when it is verified.
      </p>
      <AuditContent chain={chain} />
    </RoleGuard>
  );
}

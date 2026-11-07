import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import PageHeader from '@/components/PageHeader';
import Loader from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FormField from '@/components/ui/form-field';
import ErrorState from '@/components/ErrorState';
import StatusBadge from '@/components/StatusBadge';
import useResource from '@/hooks/useResource';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/ldrs';
import { downloadText } from '@/lib/utils';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit';
import { useToast } from '@/components/ui/use-toast';
import { Archive, CheckSquare, Download, HardDrive, RotateCcw, Save, Scale, Upload } from 'lucide-react';

const SETTING_LABELS = {
  search_limit_per_hour: 'Owner searches allowed per hour',
  captcha_after_searches: 'Ask the check question after this many searches',
  max_open_reports_per_phone: 'Open loss reports allowed per phone number',
  rapid_upload_threshold: 'Flag a finder after this many uploads in one hour',
  unclaimed_after_days: 'Mark a document unclaimed after (days)',
  document_retention_days: 'Hand unclaimed documents to the authority and delete their data after (days)',
  audit_retention_days: 'Keep audit entries for (days)',
};

const DPA_CHECKLIST = [
  'Register with the Office of the Data Protection Commissioner (ODPC) before real use.',
  'Collect only name, number and document type; say clearly why (shown on every form).',
  'Get consent from owners who give a phone number or report a loss (consent box on the report form).',
  'Agree the retention periods below and run the retention job regularly.',
  'Answer owner requests for access, correction or removal (list below).',
  'Report any data breach to the Commissioner within 72 hours — keep the breach plan with the system owner.',
  'Complete a data protection impact assessment before the pilot.',
];

function SystemContent() {
  const { user } = useLdrsUser();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState('');

  const { data, loading, error, reload } = useResource(function () {
    return Promise.all([base44.entities.Setting.list(), base44.functions.invoke('listBackups'), base44.entities.DataRequest.list('-created_date')]);
  }, []);
  const [draft, setDraft] = useState(null);

  if (loading && !data) return <Loader label="Loading settings" />;
  if (error) return <ErrorState title="Settings could not be loaded" error={error} onRetry={reload} />;

  const [settingRows, backupList, requests] = data;
  const settings = draft || settingRows;
  const backups = backupList.slice().reverse();

  const act = async function (key, fn, success) {
    setBusy(key);
    try {
      await fn();
      if (success) toast({ tone: 'success', title: success });
      setDraft(null);
      reload();
    } catch (actionError) {
      toast({ tone: 'danger', title: 'That did not work', description: actionError.message });
    } finally {
      setBusy('');
    }
  };

  const saveSettings = function () {
    act(
      'settings',
      async function () {
        for (const row of settings) {
          const value = Number(row.value);
          if (!Number.isFinite(value) || value < 1) throw new Error(SETTING_LABELS[row.key] + ' must be a positive number.');
          await base44.entities.Setting.update(row.id, { value });
        }
        await logAction({ action: AUDIT_ACTIONS.ADMIN_CHANGE, details: 'Security and retention settings saved', user });
      },
      'Settings saved',
    );
  };

  const uploadBackup = function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    act(
      'upload',
      async function () {
        const parsed = JSON.parse(await file.text());
        await base44.functions.invoke('uploadBackup', { data: parsed });
      },
      'Backup restored',
    );
    event.target.value = '';
  };

  return (
    <div className="space-y-section">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Backups
            </CardTitle>
            <CardDescription>
              A snapshot is taken automatically once a day and the last seven are kept. Test a restore regularly. Photographs are stored separately
              and are not inside the backup file.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy === 'snap'} onClick={function () { act('snap', () => base44.functions.invoke('backupNow'), 'Snapshot taken'); }}>
              <Save aria-hidden="true" />
              Take snapshot now
            </Button>
            <Button
              variant="secondary"
              disabled={busy === 'download'}
              onClick={function () {
                act('download', async function () {
                  const file = await base44.functions.invoke('downloadBackup');
                  downloadText(file.filename, JSON.stringify(file.data), 'application/json');
                });
              }}
            >
              <Download aria-hidden="true" />
              Download full backup
            </Button>
            <Button variant="secondary" disabled={busy === 'upload'} onClick={function () { if (fileRef.current) fileRef.current.click(); }}>
              <Upload aria-hidden="true" />
              Restore from file
            </Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" aria-label="Backup file to restore" onChange={uploadBackup} />
          </div>
          {backups.length ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {backups.map(function (b) {
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>Snapshot of {formatDateTime(b.taken_at)}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === b.id}
                      onClick={function () {
                        act(b.id, () => base44.functions.invoke('restoreBackup', { id: b.id }), 'Restored from snapshot');
                      }}
                    >
                      <RotateCcw aria-hidden="true" />
                      Restore
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No snapshots yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security limits and retention periods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {settings.map(function (row) {
              return (
                <FormField key={row.id} id={'set_' + row.key} label={SETTING_LABELS[row.key] || row.key}>
                  <Input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={row.value}
                    onChange={function (e) {
                      const value = e.target.value;
                      setDraft(settings.map((item) => (item.id === row.id ? { ...item, value } : item)));
                    }}
                  />
                </FormField>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy === 'settings'} onClick={saveSettings}>
              <Save aria-hidden="true" />
              Save settings
            </Button>
            <Button
              variant="secondary"
              disabled={busy === 'retention'}
              onClick={function () {
                act('retention', async function () {
                  const r = await base44.functions.invoke('runRetention');
                  toast({
                    tone: 'success',
                    title: 'Retention run finished',
                    description: r.markedUnclaimed + ' marked unclaimed, ' + r.disposed + ' disposed, ' + r.auditRemoved + ' old audit entries removed.',
                  });
                });
              }}
            >
              <Archive aria-hidden="true" />
              Run retention now
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Owner requests under the Data Protection Act, 2019
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length ? (
            <ul className="space-y-3">
              {requests.map(function (r) {
                return (
                  <li key={r.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {r.request_type} request <span className="font-normal text-muted-foreground">· {formatDateTime(r.created_date)}</span>
                      </p>
                      <StatusBadge status={r.status} kind="request" />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{r.details || 'No details given.'}</p>
                    {r.response ? <p className="mt-1 text-xs text-muted-foreground">Response: {r.response}</p> : null}
                    {r.status === 'Open' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="success"
                          disabled={busy === r.id}
                          onClick={function () {
                            act(
                              r.id,
                              () =>
                                base44.functions.invoke('completeDataRequest', {
                                  request_id: r.id,
                                  decision: 'Completed',
                                  response: r.request_type === 'Removal' ? '' : 'Handled by the administrator.',
                                }),
                              'Request completed',
                            );
                          }}
                        >
                          {r.request_type === 'Removal' ? 'Remove the data and complete' : 'Mark completed'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy === r.id}
                          onClick={function () {
                            act(
                              r.id,
                              () =>
                                base44.functions.invoke('completeDataRequest', {
                                  request_id: r.id,
                                  decision: 'Declined',
                                  response: 'Declined because the data is still needed for an active recovery.',
                                }),
                              'Request declined',
                            );
                          }}
                        >
                          Decline
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No requests yet. Owners send them from My data and privacy.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Before real use
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground marker:text-primary">
            {DPA_CHECKLIST.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SystemSettings() {
  return (
    <>
      <PageHeader title="Backups and data protection" description="Daily backups, security limits, retention periods and owner requests." />
      <SystemContent />
    </>
  );
}

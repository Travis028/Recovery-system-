import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import Loader from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [settings, setSettings] = useState(null);
  const [backups, setBackups] = useState([]);
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState('');

  const load = async function () {
    const [settingRows, backupList, requestList] = await Promise.all([
      base44.entities.Setting.list(),
      base44.functions.invoke('listBackups'),
      base44.entities.DataRequest.list('-created_date'),
    ]);
    setSettings(settingRows);
    setBackups(backupList.slice().reverse());
    setRequests(requestList);
  };
  useEffect(function () { load(); }, []);
  if (!settings) return <Loader label="Loading settings" />;

  const act = async function (key, fn, success) {
    setBusy(key);
    try {
      await fn();
      if (success) toast({ title: success });
      await load();
    } catch (error) {
      toast({ title: 'That did not work', description: error.message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  const saveSettings = function () {
    act('settings', async function () {
      for (const row of settings) {
        const value = Number(row.value);
        if (!Number.isFinite(value) || value < 1) throw new Error(SETTING_LABELS[row.key] + ' must be a positive number.');
        await base44.entities.Setting.update(row.id, { value });
      }
      await logAction({ action: AUDIT_ACTIONS.ADMIN_CHANGE, details: 'Security and retention settings saved', user });
    }, 'Settings saved');
  };

  const uploadBackup = function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    act('upload', async function () {
      const data = JSON.parse(await file.text());
      await base44.functions.invoke('uploadBackup', { data });
    }, 'Backup restored');
    event.target.value = '';
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900"><HardDrive className="h-5 w-5" />Backups</h2>
        <p className="mt-1 text-sm text-slate-500">A snapshot is taken automatically once a day (last seven kept). Test a restore regularly. Photographs are stored separately and are not inside the backup file.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="gap-2 rounded-xl bg-blue-900 hover:bg-blue-950" disabled={busy === 'snap'} onClick={function () { act('snap', function () { return base44.functions.invoke('backupNow'); }, 'Snapshot taken'); }}>
            <Save className="h-4 w-4" />Take snapshot now
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={function () {
            act('download', async function () {
              const file = await base44.functions.invoke('downloadBackup');
              downloadText(file.filename, JSON.stringify(file.data), 'application/json');
            });
          }}>
            <Download className="h-4 w-4" />Download full backup
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={function () { if (fileRef.current) fileRef.current.click(); }}>
            <Upload className="h-4 w-4" />Restore from file
          </Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={uploadBackup} />
        </div>
        <div className="mt-4 space-y-2">
          {backups.map(function (b) {
            return (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span>Snapshot of {formatDateTime(b.taken_at)}</span>
                <Button size="sm" variant="outline" className="gap-1 rounded-lg" disabled={busy === b.id} onClick={function () {
                  act(b.id, function () { return base44.functions.invoke('restoreBackup', { id: b.id }); }, 'Restored from snapshot');
                }}>
                  <RotateCcw className="h-3.5 w-3.5" />Restore
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-heading text-base font-semibold text-slate-900">Security limits and retention periods</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {settings.map(function (row) {
            return (
              <div key={row.id} className="space-y-1">
                <Label htmlFor={'set_' + row.key}>{SETTING_LABELS[row.key] || row.key}</Label>
                <Input id={'set_' + row.key} type="number" min="1" value={row.value} onChange={function (e) {
                  const value = e.target.value;
                  setSettings(settings.map(function (s) { return s.id === row.id ? { ...s, value } : s; }));
                }} />
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="gap-2 rounded-xl bg-blue-900 hover:bg-blue-950" disabled={busy === 'settings'} onClick={saveSettings}><Save className="h-4 w-4" />Save settings</Button>
          <Button variant="outline" className="gap-2 rounded-xl" disabled={busy === 'retention'} onClick={function () {
            act('retention', async function () {
              const r = await base44.functions.invoke('runRetention');
              toast({ title: 'Retention run finished', description: r.markedUnclaimed + ' marked unclaimed, ' + r.disposed + ' disposed, ' + r.auditRemoved + ' old audit entries removed.' });
            });
          }}>
            <Archive className="h-4 w-4" />Run retention now
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900"><Scale className="h-5 w-5" />Owner requests (Data Protection Act, 2019)</h2>
        {requests.length ? (
          <div className="mt-4 space-y-3">
            {requests.map(function (r) {
              return (
                <div key={r.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-heading text-sm font-semibold text-slate-900">{r.request_type} request · {formatDateTime(r.created_date)}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{r.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{r.details || 'No details given.'}</p>
                  {r.response ? <p className="mt-1 text-xs text-slate-500">Response: {r.response}</p> : null}
                  {r.status === 'Open' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" className="rounded-lg bg-emerald-600 hover:bg-emerald-700" onClick={function () {
                        act(r.id, function () { return base44.functions.invoke('completeDataRequest', { request_id: r.id, decision: 'Completed', response: r.request_type === 'Removal' ? '' : 'Handled by the administrator.' }); }, 'Request completed');
                      }}>
                        {r.request_type === 'Removal' ? 'Remove the data and complete' : 'Mark completed'}
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-lg" onClick={function () {
                        act(r.id, function () { return base44.functions.invoke('completeDataRequest', { request_id: r.id, decision: 'Declined', response: 'Declined — data still needed for an active recovery.' }); }, 'Request declined');
                      }}>Decline</Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No requests yet. Owners send them from "My data and privacy".</p>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900"><CheckSquare className="h-5 w-5" />Before real use</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {DPA_CHECKLIST.map(function (item) { return <li key={item} className="flex gap-2"><span className="text-blue-800">•</span>{item}</li>; })}
        </ul>
      </section>
    </div>
  );
}

export default function SystemSettings() {
  return (
    <RoleGuard allow={['Admin']}>
      <PageHeader title="Backups and data protection" description="Daily backups, security limits, retention periods and owner requests." />
      <SystemContent />
    </RoleGuard>
  );
}

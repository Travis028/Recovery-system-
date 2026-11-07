import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import PhoneVerification from '@/components/security/PhoneVerification';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateTime, maskPhone } from '@/lib/ldrs';
import { downloadText } from '@/lib/utils';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit';
import { useToast } from '@/components/ui/use-toast';
import { Download, Languages, Loader2, ShieldCheck } from 'lucide-react';

function MyDataContent() {
  const { user, reload } = useLdrsUser();
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [type, setType] = useState('Access');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async function () {
    setRequests(await base44.entities.DataRequest.filter({ owner_user_id: user.id }, { sort: '-created_date' }));
  };
  useEffect(function () { load(); }, [user.id]);

  const download = async function () {
    const data = await base44.functions.invoke('exportMyData');
    downloadText('my-ldrs-data.json', JSON.stringify(data, null, 2), 'application/json');
  };

  const submit = async function (event) {
    event.preventDefault();
    setBusy(true);
    try {
      await base44.entities.DataRequest.create({ owner_user_id: user.id, request_type: type, details: details.trim(), status: 'Open' });
      await logAction({ action: AUDIT_ACTIONS.DATA_REQUEST, details: type + ' request submitted', user });
      setDetails('');
      toast({ title: 'Request sent', description: 'An administrator will respond. You can follow it here.' });
      load();
    } catch (error) {
      toast({ title: 'Could not send the request', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const setLanguage = async function (language) {
    await base44.auth.updateMe({ language });
    await reload();
    toast({ title: language === 'sw' ? 'Ujumbe utatumwa kwa Kiswahili' : 'Messages will be sent in English' });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-heading text-base font-semibold text-slate-900">What LDRS stores about you</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Name</dt><dd className="text-slate-800">{user.full_name}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Email</dt><dd className="text-slate-800">{user.email}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Phone</dt><dd className="text-slate-800">{user.phone ? maskPhone(user.phone) : 'Not given'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Account created</dt><dd className="text-slate-800">{formatDateTime(user.created_date)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">Plus your loss reports, claims and alerts. Used only to return your documents, under the Data Protection Act, 2019.</p>
          <Button variant="outline" className="mt-4 gap-2 rounded-xl" onClick={download}><Download className="h-4 w-4" />Download a copy of my data</Button>
        </section>
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900"><Languages className="h-5 w-5" />Language for SMS and alerts</h2>
          <Select value={user.language || 'en'} onValueChange={setLanguage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="sw">Kiswahili</SelectItem>
            </SelectContent>
          </Select>
          <PhoneVerification user={user} onVerified={reload} />
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900"><ShieldCheck className="h-5 w-5" />Ask for access, correction or removal</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-[14rem_1fr_auto] sm:items-end" onSubmit={submit}>
          <div className="space-y-1">
            <Label htmlFor="dr_type">Request</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="dr_type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Access">See what is stored</SelectItem>
                <SelectItem value="Correction">Correct my details</SelectItem>
                <SelectItem value="Removal">Remove my data</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="dr_details">Details</Label>
            <Textarea id="dr_details" rows={1} value={details} placeholder="What should be corrected or removed?" onChange={function (e) { setDetails(e.target.value); }} />
          </div>
          <Button type="submit" className="gap-2 rounded-xl bg-blue-900 hover:bg-blue-950" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Send request
          </Button>
        </form>
        {requests.length ? (
          <div className="mt-4 space-y-2">
            {requests.map(function (r) {
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span>{r.request_type} · {formatDateTime(r.created_date)}{r.response ? ' · ' + r.response : ''}</span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700">{r.status}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function MyData() {
  const { user } = useLdrsUser();
  return (
    <RoleGuard allow={['Owner', 'Finder']}>
      <PageHeader title="My data and privacy" description="See, download, correct or remove what LDRS holds about you." />
      {user ? <MyDataContent /> : null}
    </RoleGuard>
  );
}

import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import useLdrsUser from '@/hooks/useLdrsUser';
import PageHeader from '@/components/PageHeader';
import PhoneVerification from '@/components/security/PhoneVerification';
import { Button } from '@/components/ui/button';
import FormField from '@/components/ui/form-field';
import StatusBadge from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  const load = function () {
    return api.entities.DataRequest.filter({ owner_user_id: user.id }, { sort: '-created_date' })
      .then(setRequests)
      .catch(function (error) {
        toast({ tone: 'danger', title: 'Your requests could not be loaded', description: error.message });
      });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(function () { load(); }, [user.id]);

  const download = async function () {
    try {
      const data = await api.functions.invoke('exportMyData');
      downloadText('my-ldrs-data.json', JSON.stringify(data, null, 2), 'application/json');
      toast({ tone: 'success', title: 'Your data was downloaded' });
    } catch (downloadError) {
      toast({ tone: 'danger', title: 'Could not prepare your data', description: downloadError.message });
    }
  };

  const submit = async function (event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.entities.DataRequest.create({ owner_user_id: user.id, request_type: type, details: details.trim(), status: 'Open' });
      await logAction({ action: AUDIT_ACTIONS.DATA_REQUEST, details: type + ' request submitted', user });
      setDetails('');
      toast({ tone: 'success', title: 'Request sent', description: 'An administrator will respond. You can follow it here.' });
      load();
    } catch (error) {
      toast({ tone: 'danger', title: 'Could not send the request', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  const setLanguage = async function (language) {
    try {
      await api.auth.updateMe({ language });
      await reload();
      toast({ tone: 'success', title: language === 'sw' ? 'Ujumbe utatumwa kwa Kiswahili' : 'Messages will be sent in English' });
    } catch (languageError) {
      toast({ tone: 'danger', title: 'Could not change the language', description: languageError.message });
    }
  };

  const stored = [
    ['Name', user.full_name],
    ['Email', user.email],
    ['Phone', user.phone ? maskPhone(user.phone) : 'Not given'],
    ['Account created', formatDateTime(user.created_date)],
  ];

  return (
    <div className="space-y-section">
      <div className="grid gap-section lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What LDRS stores about you</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="divide-y divide-border text-sm">
              {stored.map(function (row) {
                return (
                  <div key={row[0]} className="flex justify-between gap-3 py-2 first:pt-0">
                    <dt className="text-muted-foreground">{row[0]}</dt>
                    <dd className="text-right">{row[1]}</dd>
                  </div>
                );
              })}
            </dl>
            <p className="text-sm text-muted-foreground">Plus your loss reports, claims and alerts. They are used only to return your documents, under the Data Protection Act, 2019.</p>
            <Button variant="secondary" onClick={download}>
              <Download aria-hidden="true" />
              Download a copy of my data
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Language and phone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField id="language" label="Language for SMS and alerts">
              <Select value={user.language || 'en'} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="sw">Kiswahili</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <PhoneVerification user={user} onVerified={reload} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Ask for access, correction or removal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-4 md:grid-cols-[14rem_1fr_auto] md:items-end" onSubmit={submit} noValidate>
            <FormField id="dr_type" label="Request">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Access">See what is stored</SelectItem>
                  <SelectItem value="Correction">Correct my details</SelectItem>
                  <SelectItem value="Removal">Remove my data</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="dr_details" label="Details" optional>
              <Textarea rows={1} value={details} placeholder="What should be corrected or removed?" onChange={function (e) { setDetails(e.target.value); }} />
            </FormField>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Send request
            </Button>
          </form>
          {requests.length ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {requests.map(function (r) {
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                    <span>
                      <span className="font-medium">{r.request_type}</span>
                      <span className="text-muted-foreground"> · {formatDateTime(r.created_date)}</span>
                      {r.response ? <span className="block text-muted-foreground">{r.response}</span> : null}
                    </span>
                    <StatusBadge status={r.status} kind="request" />
                  </li>
                );
              })}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MyData() {
  const { user } = useLdrsUser();
  return (
    <>
      <PageHeader title="My data and privacy" description="See, download, correct or remove what LDRS holds about you." />
      {user ? <MyDataContent /> : null}
    </>
  );
}

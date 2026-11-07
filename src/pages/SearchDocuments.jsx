import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import PhoneVerification from '@/components/security/PhoneVerification';
import CaptchaPrompt from '@/components/security/CaptchaPrompt';
import ClaimDocumentDialog from '@/components/owner/ClaimDocumentDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DOCUMENT_TYPES, documentTypeLabel, formatDate } from '@/lib/ldrs';
import { ClipboardCheck, FileSearch, Loader2, Lock, MapPin } from 'lucide-react';

function SearchContent() {
  const { user, reload } = useLdrsUser();
  const [form, setForm] = useState({ document_type: '', name: '', number: '' });
  const [status, setStatus] = useState(null);
  const [captcha, setCaptcha] = useState(null);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [claimDoc, setClaimDoc] = useState(null);

  useEffect(function () {
    base44.functions.invoke('searchStatus').then(setStatus).catch(function () {});
  }, []);

  if (!user.phone_verified) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">To protect people's identity details, only signed-in owners with a verified phone number can search.</p>
        <PhoneVerification user={user} onVerified={reload} />
      </div>
    );
  }

  const search = async function (captchaAnswer) {
    setBusy(true);
    setError('');
    try {
      const response = await base44.functions.invoke('searchFoundDocuments', {
        ...form,
        captcha_id: captchaAnswer ? captchaAnswer.id : undefined,
        captcha_answer: captchaAnswer ? captchaAnswer.answer : undefined,
      });
      setResults(response.results);
      setCaptcha(null);
      setStatus(function (previous) {
        return { ...(previous || {}), remaining: response.remaining, captcha_required: response.captcha_required };
      });
    } catch (searchError) {
      if (searchError.code === 'captcha_required') setCaptcha(await base44.functions.invoke('getCaptcha'));
      setError(searchError.message || 'The search could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async function (event) {
    event.preventDefault();
    if (status && status.captcha_required && !captcha) {
      setCaptcha(await base44.functions.invoke('getCaptcha'));
      return;
    }
    search();
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="s_type">Document type</Label>
            <Select value={form.document_type} onValueChange={function (v) { setForm({ ...form, document_type: v }); }}>
              <SelectTrigger id="s_type"><SelectValue placeholder="Any type" /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map(function (t) { return <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>; })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="s_name">Full name on the document</Label>
            <Input id="s_name" value={form.name} placeholder="Example: Mary Wanjiru Kamau" onChange={function (e) { setForm({ ...form, name: e.target.value }); }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s_number">Or the document number</Label>
            <Input id="s_number" value={form.number} placeholder="The full number" onChange={function (e) { setForm({ ...form, number: e.target.value }); }} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5" />
            Results are partly hidden. Every search is recorded.
            {status ? ' ' + status.remaining + ' search(es) left this hour.' : ''}
          </p>
          <Button type="submit" className="gap-2 rounded-xl bg-blue-900 hover:bg-blue-950" disabled={busy || (!form.name.trim() && !form.number.trim())}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
            Search
          </Button>
        </div>
      </form>

      {captcha ? <CaptchaPrompt captcha={captcha} busy={busy} onAnswer={function (answer) { search({ id: captcha.captcha_id, answer }); }} /> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {results ? (
        results.length ? (
          <div className="space-y-3">
            {results.map(function (doc) {
              return (
                <div key={doc.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-sm font-semibold text-slate-900">{documentTypeLabel(doc.document_type)}</p>
                    <p className="mt-1 text-sm text-slate-600">{doc.owner_name}<span className="mx-2 text-slate-300">|</span>{doc.document_number}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />Found at {doc.found_location} on {formatDate(doc.date_found)}{doc.county ? ' · ' + doc.county + ' County' : ''}
                    </p>
                  </div>
                  <StatusBadge status={doc.status} />
                  <Button variant="outline" className="gap-2 rounded-xl" onClick={function () { setClaimDoc(doc); }}>
                    <ClipboardCheck className="h-4 w-4" />This is mine
                  </Button>
                </div>
              );
            })}
            <p className="text-xs text-slate-500">
              The pickup point and reference code are only shown after an officer confirms the document is yours.
            </p>
          </div>
        ) : (
          <EmptyState
            icon={FileSearch}
            title="No matching document has been handed in"
            description="Report your document as lost and we will alert you automatically when it is handed in."
            action={<Button className="rounded-xl bg-blue-900 hover:bg-blue-950" asChild><Link to="/report-lost">Report a lost document</Link></Button>}
          />
        )
      ) : null}

      <ClaimDocumentDialog
        open={Boolean(claimDoc)}
        onOpenChange={function (open) { if (!open) setClaimDoc(null); }}
        user={user}
        initialDocument={claimDoc}
        onClaimed={function () { setClaimDoc(null); }}
      />
    </div>
  );
}

export default function SearchDocuments() {
  const { user } = useLdrsUser();
  return (
    <RoleGuard allow={['Owner']}>
      <PageHeader title="Search found documents" description="Check whether your ID or certificate has been handed in at a pickup point." />
      {user ? <SearchContent /> : null}
    </RoleGuard>
  );
}

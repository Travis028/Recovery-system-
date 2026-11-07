import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import useLdrsUser from '@/hooks/useLdrsUser';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import PhoneVerification from '@/components/security/PhoneVerification';
import CaptchaPrompt from '@/components/security/CaptchaPrompt';
import ClaimDocumentDialog from '@/components/owner/ClaimDocumentDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FormField from '@/components/ui/form-field';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
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
    api.functions.invoke('searchStatus').then(setStatus).catch(function () {});
  }, []);

  if (!user.phone_verified) {
    return (
      <div className="max-w-2xl space-y-4">
        <p className="text-sm text-muted-foreground">To protect people's identity details, only signed-in owners with a verified phone number can search.</p>
        <PhoneVerification user={user} onVerified={reload} />
      </div>
    );
  }

  const askCaptcha = async function () {
    try {
      setCaptcha(await api.functions.invoke('getCaptcha'));
    } catch (captchaError) {
      setError(captchaError.message || 'The check question could not be loaded.');
    }
  };

  const search = async function (captchaAnswer) {
    setBusy(true);
    setError('');
    try {
      const response = await api.functions.invoke('searchFoundDocuments', {
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
      if (searchError.code === 'captcha_required') await askCaptcha();
      setError(searchError.message || 'The search could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const submit = function (event) {
    event.preventDefault();
    if (status && status.captcha_required && !captcha) {
      askCaptcha();
      return;
    }
    search();
  };

  const setField = function (field, value) {
    setForm(function (previous) {
      return { ...previous, [field]: value };
    });
  };

  return (
    <div className="space-y-section">
      <Card as="form" onSubmit={submit} noValidate aria-label="Search found documents">
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <FormField id="s_type" label="Document type" optional>
              <Select value={form.document_type || 'any'} onValueChange={function (v) { setField('document_type', v === 'any' ? '' : v); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any type</SelectItem>
                  {DOCUMENT_TYPES.map(function (t) {
                    return (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="s_name" label="Full name on the document">
              <Input value={form.name} autoComplete="name" placeholder="As printed on the document" onChange={function (e) { setField('name', e.target.value); }} />
            </FormField>
            <FormField id="s_number" label="Or the document number">
              <Input value={form.number} autoComplete="off" placeholder="The full number" onChange={function (e) { setField('number', e.target.value); }} />
            </FormField>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" aria-hidden="true" />
              Results are partly hidden and every search is recorded.
              {status ? ' ' + status.remaining + ' search(es) left this hour.' : ''}
            </p>
            <Button type="submit" disabled={busy || (!form.name.trim() && !form.number.trim())}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileSearch aria-hidden="true" />}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {captcha ? <CaptchaPrompt captcha={captcha} busy={busy} onAnswer={function (answer) { search({ id: captcha.captcha_id, answer }); }} /> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {results ? (
        results.length ? (
          <section aria-labelledby="results-heading" className="space-y-3">
            <h2 id="results-heading">
              {results.length} {results.length === 1 ? 'document' : 'documents'} found
            </h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card shadow-sm">
              {results.map(function (doc) {
                return (
                  <li key={doc.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{documentTypeLabel(doc.document_type)}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {doc.owner_name} · <span className="font-mono">{doc.document_number}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        Found at {doc.found_location} on {formatDate(doc.date_found)}
                        {doc.county ? ' · ' + doc.county + ' County' : ''}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />
                    <Button variant="secondary" onClick={function () { setClaimDoc(doc); }}>
                      <ClipboardCheck aria-hidden="true" />
                      This is mine
                    </Button>
                  </li>
                );
              })}
            </ul>
            <p className="text-sm text-muted-foreground">The pickup point and reference code are shown only after an officer confirms the document is yours.</p>
          </section>
        ) : (
          <EmptyState
            icon={FileSearch}
            title="No matching document has been handed in"
            description="Report your document as lost and you will be alerted automatically when it is handed in."
            action={
              <Button asChild>
                <Link to="/report-lost">Report a lost document</Link>
              </Button>
            }
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
    <>
      <PageHeader title="Search found documents" description="Check whether your ID or certificate has been handed in at a pickup point." />
      {user ? <SearchContent /> : null}
    </>
  );
}

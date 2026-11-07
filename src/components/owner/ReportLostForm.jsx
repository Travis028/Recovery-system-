import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FormField from '@/components/ui/form-field';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import useFieldErrors from '@/hooks/useFieldErrors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import PhoneVerification from '@/components/security/PhoneVerification';
import { DOCUMENT_TYPES, idLabelFor, documentTypeLabel, formatDate, maskPhone } from '@/lib/ldrs';
import { checkDocumentNumber, checkPastDate, checkPersonName, checkRequired, collectErrors, numberFormatHint, todayIso } from '@/lib/validation';
import useLdrsUser from '@/hooks/useLdrsUser';
import { CheckCircle2, Loader2, FileSearch } from 'lucide-react';


export default function ReportLostForm({ user }) {
  const { reload } = useLdrsUser();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [saved, setSaved] = useState(null);
  const [matchSummary, setMatchSummary] = useState({ exact: 0, fuzzy: 0, pickupPoint: '' });
  const [form, setForm] = useState({
    document_type: '',
    owner_name: user.full_name || '',
    document_number: '',
    phone: user.phone || '',
    date_lost: todayIso(),
  });

  const setField = function (field, value) {
    setForm(function (previous) {
      return { ...previous, [field]: value };
    });
  };

  const phoneOk = Boolean(user.phone_verified && user.phone);
  const fields = useFieldErrors(
    collectErrors({
      document_type: () => checkRequired(form.document_type, 'Choose the type of document.'),
      owner_name: () => checkPersonName(form.owner_name),
      document_number: () => (form.document_type ? checkDocumentNumber(form.document_type, form.document_number) : checkRequired(form.document_number, 'Enter the number printed on the document.')),
      date_lost: () => checkPastDate(form.date_lost, 'date lost'),
      consent: () => (consent ? '' : 'Tick the box to give consent before sending the report.'),
    }),
  );

  const submit = async function (event) {
    event.preventDefault();
    if (!fields.submit()) return;
    setSubmitting(true);
    setError('');
    try {
      // Checked on the server: verified phone, consent, number format, report limit per phone.
      const result = await base44.functions.invoke('submitLossReport', {
        document_type: form.document_type,
        owner_name: form.owner_name.trim(),
        document_number: form.document_number.trim(),
        date_lost: form.date_lost,
        consent,
      });
      const created = result.report;
      const exact = result.matches.filter(function (item) {
        return item.match_type === 'Exact';
      });
      const fuzzy = result.matches.filter(function (item) {
        return item.match_type === 'Fuzzy';
      });
      setMatchSummary({
        exact: exact.length,
        fuzzy: fuzzy.length,
        pickupPoint: exact.length ? exact[0].pickup_point_name : '',
      });
      setSaved(created);
    } catch (submitError) {
      console.error('Lost report could not be saved', submitError);
      setError(submitError.message || 'The report could not be saved. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) {
    return (
      <div className="rounded-lg border border-success-border bg-card p-card shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle text-success-subtle-foreground">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2>Lost report submitted</h2>
            <p className="text-sm text-muted-foreground">
              We will alert you as soon as a document matching this report is handed in.
            </p>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-muted p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Report reference</dt>
            <dd className="mt-1 text-sm font-medium">{saved.id.slice(0, 8).toUpperCase()}</dd>
          </div>
          <div className="rounded-md bg-muted p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Report status</dt>
            <dd className="mt-1 text-sm font-medium">Open, waiting for a match</dd>
          </div>
          <div className="rounded-md bg-muted p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Document type</dt>
            <dd className="mt-1 text-sm font-medium">{documentTypeLabel(saved.document_type)}</dd>
          </div>
          <div className="rounded-md bg-muted p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date lost</dt>
            <dd className="mt-1 text-sm font-medium">{formatDate(saved.date_lost)}</dd>
          </div>
        </dl>

        {matchSummary.exact ? (
          <Alert tone="success" className="mt-4">
            A document already held at {matchSummary.pickupPoint || 'a pickup point'} matches this report. An alert with
            the reference code and the pickup point has been added to your Alerts screen. Carry the document number with
            you when you collect it.
          </Alert>
        ) : null}
        {!matchSummary.exact && matchSummary.fuzzy ? (
          <Alert tone="warning" className="mt-4">
            A possible match for a document already handed in is being reviewed by an officer. You will be alerted once
            it is confirmed.
          </Alert>
        ) : null}
        {!matchSummary.exact && !matchSummary.fuzzy ? (
          <Alert tone="info" className="mt-4">
            No matching document has been handed in yet. You can search the documents that have been found at any time.
          </Alert>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/search">
              <FileSearch aria-hidden="true" />
              Search found documents now
            </Link>
          </Button>
          <Button
            variant="secondary"
            onClick={function () {
              setSaved(null);
              setConsent(false);
              fields.reset();
              setMatchSummary({ exact: 0, fuzzy: 0, pickupPoint: '' });
              setForm({
                document_type: '',
                owner_name: user.full_name || '',
                document_number: '',
                phone: user.phone || '',
                date_lost: todayIso(),
              });
            }}
          >
            Report another document
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-section">
      {!phoneOk ? <PhoneVerification user={user} onVerified={reload} /> : null}

      <Card as="section">
        <CardHeader>
          <div>
            <CardTitle>The document</CardTitle>
            <CardDescription>Type the details exactly as they are printed, so the match works.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0 sm:grid-cols-2">
          <FormField id="document_type" label="Document type" error={fields.show('document_type')} className="sm:col-span-2">
            <Select value={form.document_type} onValueChange={function (value) { setField('document_type', value); }}>
              <SelectTrigger onBlur={fields.touch('document_type')}>
                <SelectValue placeholder="Select the type of document" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map(function (type) {
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="owner_name" label="Your full name as printed on the document" error={fields.show('owner_name')} className="sm:col-span-2">
            <Input value={form.owner_name} autoComplete="name" onBlur={fields.touch('owner_name')} onChange={function (event) { setField('owner_name', event.target.value); }} />
          </FormField>
          <FormField
            id="document_number"
            label={idLabelFor(form.document_type)}
            error={fields.show('document_number')}
            hint={'Used only to match you with your document and never shown publicly.' + (form.document_type ? ' Format: ' + numberFormatHint(form.document_type) + '.' : '')}
          >
            <Input value={form.document_number} autoComplete="off" onBlur={fields.touch('document_number')} onChange={function (event) { setField('document_number', event.target.value); }} />
          </FormField>
          <FormField id="date_lost" label="Date the document was lost" error={fields.show('date_lost')}>
            <Input type="date" max={todayIso()} value={form.date_lost} onBlur={fields.touch('date_lost')} onChange={function (event) { setField('date_lost', event.target.value); }} />
          </FormField>
        </CardContent>
      </Card>

      <Card as="section">
        <CardHeader>
          <CardTitle>How we reach you</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <FormField id="phone" label="Phone number" hint="We use this number only to contact you about this report.">
            <Input value={phoneOk ? maskPhone(user.phone) + ' (verified)' : 'Not verified yet'} readOnly disabled />
          </FormField>
          <div className="space-y-1.5">
            <label htmlFor="consent" className="flex items-start gap-3 rounded-md border border-border bg-muted/50 p-4">
              <Checkbox
                id="consent"
                checked={consent}
                aria-invalid={fields.show('consent') ? true : undefined}
                aria-describedby={fields.show('consent') ? 'consent-error' : undefined}
                onCheckedChange={function (value) { setConsent(Boolean(value)); }}
                className="mt-0.5"
              />
              <span className="text-sm text-muted-foreground">
                I confirm this phone number belongs to me. I consent to LDRS storing my name, document number and phone number only to help
                recover this document, as required by the Data Protection Act, 2019.
              </span>
            </label>
            {fields.show('consent') ? (
              <p id="consent-error" className="text-xs font-medium text-danger-subtle-foreground">
                {fields.show('consent')}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Button type="submit" disabled={submitting || !phoneOk}>
        {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        Submit lost report
      </Button>
    </form>
  );
}

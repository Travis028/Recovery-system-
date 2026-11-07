import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import Loader from '@/components/Loader';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import PrivateImage from '@/components/PrivateImage';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import FormField from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { documentTypeLabel, formatDate, formatDateTime, idLabelFor, normalizeId } from '@/lib/ldrs';
import { cn } from '@/lib/utils';
import useFieldErrors from '@/hooks/useFieldErrors';
import { checkCode, checkMaxLength, checkRequired, collectErrors } from '@/lib/validation';

const OTP_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 3;
const CLAIMANT_ID_TYPES = ['National ID', 'Passport', "Driver's License", 'Employment ID', 'Other'];

function Step({ number, title, description, children }) {
  return (
    <Card as="section" aria-labelledby={'step-' + number}>
      <CardHeader className="justify-start">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden="true">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle id={'step-' + number}>
            <span className="sr-only">Step {number}: </span>
            {title}
          </CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Check({ ok, label, hint }) {
  const Icon = ok ? CheckCircle2 : Circle;
  return (
    <li className={cn('flex items-start gap-3 rounded-md border p-3', ok ? 'border-success-border bg-success-subtle' : 'border-border bg-card')}>
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ok ? 'text-success' : 'text-muted-foreground')} aria-hidden="true" />
      <div>
        <p className="text-sm font-medium">
          {label}
          <span className="sr-only">{ok ? ': done' : ': not done yet'}</span>
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </li>
  );
}

function SecureHandoverContent() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [match, setMatch] = useState(null);
  const [document, setDocument] = useState(null);
  const [point, setPoint] = useState(null);
  const [otp, setOtp] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [referenceInput, setReferenceInput] = useState('');
  const [numberInput, setNumberInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [claimant, setClaimant] = useState('');
  const [claimantIdType, setClaimantIdType] = useState('National ID');
  const [claimantIdNumber, setClaimantIdNumber] = useState('');
  const [physicalChecked, setPhysicalChecked] = useState(false);
  const [notes, setNotes] = useState('');

  const referenceOk = Boolean(match) && referenceInput.trim().toUpperCase() === String(match.reference_code || '').toUpperCase();
  const numberOk = Boolean(document) && normalizeId(numberInput) !== '' && normalizeId(numberInput) === normalizeId(document.document_number);
  const otpAttempts = otp ? Number(otp.attempts || 0) : 0;
  const otpExpired = Boolean(otp) && new Date(otp.expires_at).getTime() <= now;
  const otpLocked = Boolean(otp) && (otp.used || otp.locked || otpAttempts >= MAX_OTP_ATTEMPTS);
  const otpActive = Boolean(otp) && !otpLocked && !otpExpired;
  const otpReady = otpActive && /^\d{6}$/.test(otpInput.trim());

  const fields = useFieldErrors(
    collectErrors({
      reference: () => checkRequired(referenceInput, 'Enter the reference code the owner received.') || (referenceOk ? '' : 'This reference code does not match the record.'),
      number: () => checkRequired(numberInput, 'Enter the number on the document the claimant describes.') || (numberOk ? '' : 'This number does not match the document on record.'),
      otp: () => (!otp ? 'Create a collection code for the owner first.' : otpActive ? checkCode(otpInput) : 'This code can no longer be used. Create a new one.'),
      claimant: () => (claimant.trim().length >= 3 ? '' : 'Enter the full name of the person collecting.'),
      claimant_id_number: () => (claimantIdNumber.trim().length >= 4 ? '' : 'Enter the number on the ID they showed.'),
      notes: () => checkMaxLength(notes, 500, 'The note'),
      physical_check: () => (physicalChecked ? '' : 'Confirm that you compared the ID with the record.'),
    }),
  );

  const loadOtp = async function () {
    const otpList = await base44.entities.OtpCode.filter({ match_id: matchId }, { sort: '-created_date', limit: 1 });
    setOtp(otpList[0] || null);
  };

  const load = async function () {
    setLoading(true);
    try {
      const record = await base44.entities.Match.get(matchId);
      setMatch(record);
      const doc = await base44.entities.Document.get(record.document_id);
      setDocument(doc);
      if (doc.pickup_point_id) {
        setPoint(await base44.entities.PickupPoint.get(doc.pickup_point_id).catch(function () { return null; }));
      }
      await loadOtp();
    } catch (loadError) {
      console.error('Handover details could not be loaded', loadError);
      setMissing(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(
    function () {
      if (matchId) load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchId],
  );

  useEffect(function () {
    const timer = setInterval(function () {
      setNow(Date.now());
    }, 1000);
    return function () {
      clearInterval(timer);
    };
  }, []);

  const generateCode = async function () {
    setGenerating(true);
    setError('');
    try {
      setOtp(await base44.functions.invoke('generateCollectionCode', { match_id: match.id }));
      setOtpInput('');
    } catch (generateError) {
      setError(generateError.message || 'The collection code could not be created. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <Loader label="Opening handover" />;

  if (missing || !match || !document) {
    return (
      <EmptyState
        title="Handover not found"
        description="It may belong to another station."
        action={
          <Button variant="secondary" asChild>
            <Link to="/handover">Back to handover</Link>
          </Button>
        }
      />
    );
  }

  if (match.match_status === 'Returned' || document.status === 'Returned') {
    return (
      <Alert
        tone="success"
        title="This document has already been released"
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/handover">Back to handover</Link>
          </Button>
        }
      >
        A document can only be handed over once. Open its receipt from the handover list.
      </Alert>
    );
  }

  const secondsLeft = otpActive ? Math.max(0, Math.round((new Date(otp.expires_at).getTime() - now) / 1000)) : 0;
  const approve = async function () {
    if (!fields.submit()) return;
    setSubmitting(true);
    setError('');
    try {
      const handover = await base44.functions.invoke('completeHandover', {
        match_id: match.id,
        reference_code: referenceInput,
        document_number: numberInput,
        otp: otpInput,
        released_to: claimant,
        claimant_id_type: claimantIdType,
        claimant_id_number: claimantIdNumber,
        notes,
      });
      navigate('/receipt/' + handover.id);
    } catch (approveError) {
      setError(approveError.message || 'The handover could not be completed. Check the details and try again.');
      setOtpInput('');
      await loadOtp();
    } finally {
      setSubmitting(false);
    }
  };

  const otpStatus = otpLocked
    ? 'Blocked or already used'
    : otpExpired
      ? 'Expired'
      : 'Sent to the owner · ' + Math.floor(secondsLeft / 60) + ':' + String(secondsLeft % 60).padStart(2, '0') + ' left';

  return (
    <div className="space-y-section">
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Document</p>
            <h2 className="mt-1">{documentTypeLabel(document.document_type)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {document.owner_name} · {idLabelFor(document.document_type)} <span className="font-mono">{document.document_number}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Reference <span className="font-mono">{match.reference_code}</span> · held at {point ? point.name : 'the pickup point'} · found{' '}
              {formatDate(document.date_found)}
            </p>
          </div>
          <StatusBadge status={document.status} />
        </CardHeader>
        {document.image_url ? (
          <CardContent>
            <PrivateImage fileUri={document.image_url} alt="Photograph of the document" className="h-48 w-full rounded-md border border-border bg-muted" />
          </CardContent>
        ) : null}
      </Card>

      <Step
        number={1}
        title="Create a collection code"
        description={
          "The code goes to the owner's phone and dashboard, never to this screen. It expires after " +
          OTP_MINUTES +
          ' minutes, works once, and is blocked after ' +
          MAX_OTP_ATTEMPTS +
          ' wrong attempts.'
        }
      >
        {otp ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-info-border bg-info-subtle p-4 text-info-subtle-foreground">
            <div aria-live="polite">
              <p className="text-xs font-medium uppercase tracking-wide">Collection code</p>
              <p className="mt-1 font-semibold">{otpStatus}</p>
              <p className="mt-1 text-xs">
                Expires {formatDateTime(otp.expires_at)} · {otpAttempts} of {MAX_OTP_ATTEMPTS} attempts used
              </p>
            </div>
            <Button variant="secondary" disabled={generating} onClick={generateCode}>
              {generating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
              Create a new code
            </Button>
          </div>
        ) : (
          <Button disabled={generating} onClick={generateCode}>
            {generating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
            Create six-digit code
          </Button>
        )}
      </Step>

      <Step number={2} title="Check the claimant" description="Compare the reference code, the document they describe, and the code on the owner's phone.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField error={fields.show('reference')} id="reference" label="Reference code">
            <Input value={referenceInput} onBlur={fields.touch('reference')} placeholder="LDRS-XXXXXX" autoComplete="off" onChange={function (event) { setReferenceInput(event.target.value); }} />
          </FormField>
          <FormField error={fields.show('number')} id="number" label={idLabelFor(document.document_type) + ' presented'}>
            <Input value={numberInput} onBlur={fields.touch('number')} autoComplete="off" onChange={function (event) { setNumberInput(event.target.value); }} />
          </FormField>
          <FormField error={fields.show('otp')} id="otp" label="Six-digit code from the owner">
            <Input
              value={otpInput}
              onBlur={fields.touch('otp')}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              placeholder="000000"
              onChange={function (event) {
                setOtpInput(event.target.value.replace(/\D/g, ''));
              }}
            />
          </FormField>
        </div>
      </Step>

      <Step number={3} title="Record who is collecting" description="This goes on the receipt and in the audit trail.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField error={fields.show('claimant')} id="claimant" label="Full name of the person collecting" className="sm:col-span-2">
            <Input value={claimant} onBlur={fields.touch('claimant')} autoComplete="off" onChange={function (event) { setClaimant(event.target.value); }} />
          </FormField>
          <FormField id="claimant_id_type" label="ID they showed">
            <Select value={claimantIdType} onValueChange={setClaimantIdType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLAIMANT_ID_TYPES.map(function (type) {
                  return (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FormField>
          <FormField error={fields.show('claimant_id_number')} id="claimant_id_number" label="Number on that ID">
            <Input value={claimantIdNumber} onBlur={fields.touch('claimant_id_number')} autoComplete="off" onChange={function (event) { setClaimantIdNumber(event.target.value); }} />
          </FormField>
          <FormField error={fields.show('notes')} id="notes" label="Handover note" optional className="sm:col-span-2">
            <Textarea value={notes} onBlur={fields.touch('notes')} rows={2} onChange={function (event) { setNotes(event.target.value); }} />
          </FormField>
        </div>
        <label htmlFor="physical_check" className="mt-4 flex items-start gap-3 rounded-md border border-border bg-muted p-4">
          <Checkbox
            id="physical_check"
            checked={physicalChecked}
            aria-invalid={fields.show('physical_check') ? true : undefined}
            aria-describedby={fields.show('physical_check') ? 'physical_check-error' : undefined}
            onCheckedChange={function (value) { setPhysicalChecked(Boolean(value)); }}
            className="mt-0.5"
          />
          <span className="text-sm text-foreground">
            I have compared the claimant's ID with the record and the photograph, and the person in front of me is the person named on
            it, or is authorised to collect for them.
          </span>
        </label>
        {fields.show('physical_check') ? (
          <p id="physical_check-error" className="mt-1.5 text-xs font-medium text-danger-subtle-foreground">
            {fields.show('physical_check')}
          </p>
        ) : null}
      </Step>

      <Step number={4} title="Release the document">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Checks before release">
          <Check ok={referenceOk} label="Reference code" hint="Matches the code sent to the owner." />
          <Check ok={numberOk} label="Document number" hint="Matches the number on record." />
          <Check
            ok={otpReady}
            label="Collection code"
            hint={
              otp
                ? otpLocked
                  ? 'Blocked or used. Create a new one.'
                  : otpExpired
                    ? 'Expired. Create a new one.'
                    : 'Checked by the server on release. ' + (MAX_OTP_ATTEMPTS - otpAttempts) + ' attempt(s) left.'
                : 'Create a code for the owner first.'
            }
          />
          <Check ok={physicalChecked} label="Physical ID" hint="You compared the ID with the record." />
        </ul>

        {error ? (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="success" disabled={submitting} onClick={approve}>
            {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
            Approve release
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/handover">
              <ArrowLeft aria-hidden="true" />
              Back to handover
            </Link>
          </Button>
          {!fields.valid ? <p className="text-sm text-muted-foreground">Every check must pass before the document can be released.</p> : null}
        </div>
      </Step>
    </div>
  );
}

export default function SecureHandover() {
  return (
    <RoleGuard allow={['Officer', 'Admin']}>
      <PageHeader
        title="Secure handover"
        description="Check the reference code, the document and the one-time code before releasing the document."
        breadcrumbs={[{ label: 'Handover', to: '/handover' }, { label: 'Secure handover' }]}
      />
      <SecureHandoverContent />
    </RoleGuard>
  );
}

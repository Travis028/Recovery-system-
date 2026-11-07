import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import Loader from '@/components/Loader';
import StatusBadge from '@/components/StatusBadge';
import PrivateImage from '@/components/PrivateImage';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { documentTypeLabel, formatDate, formatDateTime, idLabelFor, normalizeId } from '@/lib/ldrs';
import { AlertTriangle, ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldCheck, XCircle } from 'lucide-react';

const OTP_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 3;
const CLAIMANT_ID_TYPES = ['National ID', 'Passport', "Driver's License", 'Employment ID', 'Other'];

function CheckRow({ ok, label, hint }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
      )}
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

function SecureHandoverContent() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useLdrsUser();
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

  const loadOtp = async function () {
    const otpList = await base44.entities.OtpCode.filter({ match_id: matchId }, { sort: '-created_date', limit: 1 });
    setOtp((otpList.items || [])[0] || null);
  };

  const load = async function () {
    setLoading(true);
    try {
      const record = await base44.entities.Match.get(matchId);
      setMatch(record);
      const doc = await base44.entities.Document.get(record.document_id);
      setDocument(doc);
      if (doc.pickup_point_id) {
        setPoint(
          await base44.entities.PickupPoint.get(doc.pickup_point_id).catch(function () {
            return null;
          }),
        );
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
      const created = await base44.functions.invoke('generateCollectionCode', { match_id: match.id });
      setOtp(created);
      setOtpInput('');
    } catch (generateError) {
      console.error('Collection code could not be generated', generateError);
      setError(generateError.message || 'The collection code could not be generated. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <Loader label="Opening handover" />;

  if (missing || !match || !document) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="font-heading text-lg font-semibold text-slate-800">Handover not found</p>
        <p className="mt-1 text-sm text-slate-500">It may belong to another station.</p>
        <Button variant="outline" className="mt-4 rounded-xl" asChild>
          <Link to="/handover">Back to handover list</Link>
        </Button>
      </div>
    );
  }

  if (match.match_status === 'Returned' || document.status === 'Returned') {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <p className="font-heading text-lg font-semibold text-emerald-900">This document has already been released</p>
        <p className="mt-1 text-sm text-emerald-800">A document can only be handed over once. Open the receipt from the handover list.</p>
        <Button variant="outline" className="mt-4 rounded-xl bg-white" asChild>
          <Link to="/handover">Back to handover list</Link>
        </Button>
      </div>
    );
  }

  const referenceOk = referenceInput.trim().toUpperCase() === String(match.reference_code || '').toUpperCase();
  const numberOk = normalizeId(numberInput) !== '' && normalizeId(numberInput) === normalizeId(document.document_number);
  const otpAttempts = otp ? Number(otp.attempts || 0) : 0;
  const otpExpired = Boolean(otp) && new Date(otp.expires_at).getTime() <= now;
  const otpLocked = Boolean(otp) && (otp.used || otp.locked || otpAttempts >= MAX_OTP_ATTEMPTS);
  const otpActive = Boolean(otp) && !otpLocked && !otpExpired;
  const otpReady = otpActive && /^\d{6}$/.test(otpInput.trim());
  const secondsLeft = otpActive ? Math.max(0, Math.round((new Date(otp.expires_at).getTime() - now) / 1000)) : 0;
  const canApprove =
    referenceOk && numberOk && otpReady && physicalChecked && claimant.trim().length > 2 && claimantIdNumber.trim().length > 3;

  const approve = async function () {
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
      console.error('Handover could not be completed', approveError);
      setError(approveError.message || 'The handover could not be completed. Check the details and try again.');
      setOtpInput('');
      await loadOtp();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document</p>
            <p className="mt-1 font-heading text-lg font-semibold text-slate-900">
              {documentTypeLabel(document.document_type)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {document.owner_name} | {idLabelFor(document.document_type)} {document.document_number}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Reference code {match.reference_code} | Held at {point ? point.name : 'the pickup point'} | Found{' '}
              {formatDate(document.date_found)}
            </p>
          </div>
          <StatusBadge status={document.status} />
        </div>
        {document.image_url ? (
          <PrivateImage fileUri={document.image_url} className="mt-4 h-48 w-full rounded-2xl border border-slate-200 bg-slate-50" />
        ) : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-heading text-base font-semibold text-slate-900">Step 1 - Generate a collection code</h2>
        <p className="mt-1 text-sm text-slate-500">
          The code is sent to the owner's phone and shown on their LDRS dashboard — never on this screen. It expires after{' '}
          {OTP_MINUTES} minutes, can only be used once, and is blocked after {MAX_OTP_ATTEMPTS} wrong attempts.
        </p>

        {otp ? (
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Collection code status</p>
            <p className="mt-1 font-heading text-lg font-bold text-blue-900">
              {otpLocked ? 'Blocked or used' : otpExpired ? 'Expired' : 'Sent to the owner · ' + Math.floor(secondsLeft / 60) + ':' + String(secondsLeft % 60).padStart(2, '0') + ' left'}
            </p>
            <p className="mt-1 text-xs text-blue-900">
              Expires {formatDateTime(otp.expires_at)} | {otpAttempts} of {MAX_OTP_ATTEMPTS} attempts used
            </p>
            <Button
              variant="outline"
              className="mt-3 gap-2 rounded-xl border-blue-200 bg-white"
              disabled={generating}
              onClick={generateCode}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Generate a new code
            </Button>
          </div>
        ) : (
          <Button
            className="mt-4 gap-2 rounded-xl bg-blue-900 hover:bg-blue-950"
            disabled={generating}
            onClick={generateCode}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Generate six-digit code
          </Button>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-heading text-base font-semibold text-slate-900">Step 2 - OTP verification</h2>
        <p className="mt-1 text-sm text-slate-500">
          Check the reference code, the document the claimant has brought and the code on the owner's phone.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reference">Reference code</Label>
            <Input
              id="reference"
              value={referenceInput}
              placeholder="LDRS-XXXXXX"
              onChange={function (event) {
                setReferenceInput(event.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="number">{idLabelFor(document.document_type)} presented</Label>
            <Input
              id="number"
              value={numberInput}
              placeholder="Type the number on the document"
              onChange={function (event) {
                setNumberInput(event.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="otp">Six-digit code from the owner</Label>
            <Input
              id="otp"
              value={otpInput}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              placeholder="000000"
              onChange={function (event) {
                setOtpInput(event.target.value.replace(/\D/g, ''));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="claimant">Name of the person collecting</Label>
            <Input
              id="claimant"
              value={claimant}
              placeholder="Full name of the claimant"
              onChange={function (event) {
                setClaimant(event.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="claimant_id_type">ID type of the person collecting</Label>
            <Select value={claimantIdType} onValueChange={setClaimantIdType}>
              <SelectTrigger id="claimant_id_type">
                <SelectValue placeholder="Select the ID type" />
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="claimant_id_number">Their ID number</Label>
            <Input
              id="claimant_id_number"
              value={claimantIdNumber}
              placeholder="Number on the ID presented"
              onChange={function (event) {
                setClaimantIdNumber(event.target.value);
              }}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Handover note</Label>
            <Textarea
              id="notes"
              value={notes}
              rows={3}
              placeholder="Optional note about the handover"
              onChange={function (event) {
                setNotes(event.target.value);
              }}
            />
          </div>
        </div>

        <label htmlFor="physical_check" className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <Checkbox
            id="physical_check"
            checked={physicalChecked}
            onCheckedChange={function (value) {
              setPhysicalChecked(Boolean(value));
            }}
            className="mt-0.5"
          />
          <span className="text-xs leading-relaxed text-slate-600">
            I have compared the claimant's physical ID with the record and the photograph, and the person in front of me is
            the person named on it (or is authorised to collect for them).
          </span>
        </label>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <CheckRow ok={referenceOk} label="Reference code" hint="Matches the code sent to the owner." />
          <CheckRow ok={numberOk} label="Document number" hint="Matches the number recorded on the document." />
          <CheckRow
            ok={otpReady}
            label="One-time code"
            hint={
              otp
                ? otpLocked
                  ? 'This code is blocked or used. Generate a new one.'
                  : otpExpired
                    ? 'This code has expired. Generate a new one.'
                    : 'Checked by the server when you approve. ' + (MAX_OTP_ATTEMPTS - otpAttempts) + ' attempt(s) left.'
                : 'Generate a code for the owner first.'
            }
          />
          <CheckRow ok={physicalChecked} label="Physical ID" hint="Officer compared the ID with the record." />
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700"
            disabled={!canApprove || submitting}
            onClick={approve}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Approve release
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl" asChild>
            <Link to="/handover">
              <ArrowLeft className="h-4 w-4" />
              Back to handover list
            </Link>
          </Button>
        </div>

        {!canApprove ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            Approve release stays locked until the checks pass and the claimant's name and ID are entered.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function SecureHandover() {
  return (
    <RoleGuard allow={['Officer', 'Admin']}>
      <PageHeader
        title="Secure handover"
        description="Verify the reference code, the document and the one-time code before releasing the document."
        breadcrumbs={[{ label: 'Handover', to: '/handover' }, { label: 'Secure handover' }]}
      />
      <SecureHandoverContent />
    </RoleGuard>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import PhotoUpload from '@/components/documents/PhotoUpload';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DOCUMENT_TYPES, documentTypeLabel, idLabelFor } from '@/lib/ldrs';
import { checkDocumentNumber, checkPersonName, numberFormatHint } from '@/lib/validation';
import { extractDocumentFields, LOW_CONFIDENCE } from '@/lib/ocr';
import { AlertTriangle, CheckCircle2, Loader2, ScanText, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const today = new Date().toISOString().slice(0, 10);
const EMPTY = { document_type: '', owner_name: '', document_number: '', found_location: '', date_found: today, pickup_point_id: '' };

function ReportFoundContent() {
  const { user, role } = useLdrsUser();
  const [points, setPoints] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState({ uri: '', sha256: '', phash: '', file: null });
  const [ocr, setOcr] = useState(null); // { name, number, nameConfidence, numberConfidence }
  const [ocrState, setOcrState] = useState({ busy: false, message: '' });
  const [confirmed, setConfirmed] = useState({ name: false, number: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(function () {
    base44.functions.invoke('listPublicPickupPoints').then(function (list) {
      setPoints(list);
      if (role === 'Officer' && user.pickup_point_id) {
        setForm(function (previous) {
          return { ...previous, pickup_point_id: user.pickup_point_id };
        });
      }
    });
  }, [role, user.pickup_point_id]);

  const setField = function (field, value) {
    setForm(function (previous) {
      return { ...previous, [field]: value };
    });
    if (field === 'owner_name') setConfirmed(function (c) { return { ...c, name: true }; });
    if (field === 'document_number') setConfirmed(function (c) { return { ...c, number: true }; });
  };

  const runOcr = async function () {
    if (!photo.file || !form.document_type) return;
    setOcrState({ busy: true, message: 'Starting the OCR engine' });
    try {
      const fields = await extractDocumentFields(photo.file, form.document_type, function (status, progress) {
        setOcrState({ busy: true, message: status + (progress ? ' (' + Math.round(progress * 100) + '%)' : '') });
      });
      setOcr(fields);
      setForm(function (previous) {
        return { ...previous, owner_name: fields.name || previous.owner_name, document_number: fields.number || previous.document_number };
      });
      setConfirmed({ name: fields.nameConfidence >= LOW_CONFIDENCE, number: fields.numberConfidence >= LOW_CONFIDENCE && !fields.numberProblem });
      setOcrState({ busy: false, message: '' });
    } catch (ocrError) {
      console.error('OCR failed', ocrError);
      setOcrState({ busy: false, message: 'The OCR engine could not run here (it downloads once and needs internet). Type the details from the document instead.' });
    }
  };

  const nameProblem = form.owner_name ? checkPersonName(form.owner_name) : '';
  const numberProblem = form.document_type && form.document_number ? checkDocumentNumber(form.document_type, form.document_number) : '';
  const needsNameConfirm = Boolean(ocr) && ocr.nameConfidence < LOW_CONFIDENCE && !confirmed.name;
  const needsNumberConfirm = Boolean(ocr) && (ocr.numberConfidence < LOW_CONFIDENCE || Boolean(ocr.numberProblem)) && !confirmed.number;
  const complete =
    form.document_type && photo.uri && form.owner_name && !nameProblem && form.document_number && !numberProblem &&
    form.found_location.trim() && form.date_found && form.pickup_point_id && !needsNameConfirm && !needsNumberConfirm;

  const submit = async function (event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await base44.functions.invoke('registerFoundDocument', {
        ...form,
        image_url: photo.uri,
        image_sha256: photo.sha256,
        image_phash: photo.phash,
        ocr: ocr
          ? {
              used: true,
              name_accepted: Boolean(ocr.name) && ocr.name === form.owner_name.trim().toUpperCase(),
              number_accepted: Boolean(ocr.number) && ocr.number === form.document_number.trim().toUpperCase(),
              name_confidence: ocr.nameConfidence,
              number_confidence: ocr.numberConfidence,
            }
          : { used: false },
      });
      setResult(response);
    } catch (submitError) {
      setError(submitError.message || 'The document could not be registered.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = function () {
    setResult(null);
    setForm({ ...EMPTY, pickup_point_id: role === 'Officer' ? user.pickup_point_id : '' });
    setPhoto({ uri: '', sha256: '', phash: '', file: null });
    setOcr(null);
    setConfirmed({ name: false, number: false });
  };

  if (result) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-heading text-xl font-bold text-slate-900">Document registered</h2>
            <p className="text-sm text-slate-500">
              {documentTypeLabel(result.document.document_type)} recorded at {result.pickup_point_name}.
              {role === 'Finder' ? ' Please hand the document in at this pickup point.' : ''}
            </p>
          </div>
        </div>
        {result.exact ? (
          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            The number matches a loss report. The owner has been alerted with the pickup point and a reference code.
          </p>
        ) : null}
        {!result.exact && result.fuzzy ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {result.fuzzy} possible match(es) by name were sent to an officer for review.
          </p>
        ) : null}
        {!result.exact && !result.fuzzy ? (
          <p className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            No loss report matches yet. The owner will be matched automatically when they report it.
          </p>
        ) : null}
        {result.duplicate_reasons.length ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Flagged for an officer to check</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {result.duplicate_reasons.map(function (reason) {
                return <li key={reason}>{reason}</li>;
              })}
            </ul>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="rounded-xl bg-blue-900 hover:bg-blue-950" onClick={reset}>Register another document</Button>
          <Button variant="outline" className="rounded-xl" asChild>
            <Link to={'/documents/' + result.document.id}>Open the record</Link>
          </Button>
        </div>
      </div>
    );
  }

  const lowField = function (kind) {
    if (!ocr) return '';
    const confidence = kind === 'name' ? ocr.nameConfidence : ocr.numberConfidence;
    const ok = kind === 'name' ? confirmed.name : confirmed.number;
    if (confidence >= LOW_CONFIDENCE && !(kind === 'number' && ocr.numberProblem)) return '';
    return ok ? '' : 'border-amber-400 ring-2 ring-amber-200';
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-heading text-base font-semibold text-slate-900">1 · Document type and photograph</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="document_type">Document type</Label>
              <Select value={form.document_type} onValueChange={function (value) { setField('document_type', value); }}>
                <SelectTrigger id="document_type"><SelectValue placeholder="Select the type of document" /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(function (type) {
                    return <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">Before you photograph</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>Lay the document flat in good light, with the name and number readable.</li>
                <li>Do not post the photo anywhere else — LDRS stores it encrypted.</li>
                <li>Location data in the photo is removed automatically.</li>
              </ul>
            </div>
            <Button type="button" variant="outline" className="w-full gap-2 rounded-xl" disabled={!photo.file || !form.document_type || ocrState.busy} onClick={runOcr}>
              {ocrState.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
              Read name and number from the photograph (OCR)
            </Button>
            {ocrState.message ? <p className={cn('text-xs', ocrState.busy ? 'text-slate-500' : 'text-amber-700')}>{ocrState.message}</p> : null}
          </div>
          <PhotoUpload
            fileUri={photo.uri}
            onChange={function (uri, meta) {
              setPhoto({ uri, sha256: meta.sha256, phash: meta.phash, file: meta.file });
              setOcr(null);
            }}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-heading text-base font-semibold text-slate-900">2 · Details on the document</h2>
        {ocr ? (
          <p className="mt-2 flex items-start gap-2 rounded-2xl bg-violet-50 p-3 text-xs text-violet-900">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            OCR read the fields below (name {ocr.nameConfidence}% sure, number {ocr.numberConfidence}% sure). Fields highlighted in amber are uncertain — compare them with the document and confirm.
          </p>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="owner_name">Name on the document</Label>
            <Input id="owner_name" className={lowField('name')} value={form.owner_name} placeholder="As printed, for example JANE AKINYI OTIENO" onChange={function (e) { setField('owner_name', e.target.value); }} />
            {nameProblem ? <p className="text-xs text-rose-600">{nameProblem}</p> : null}
            {needsNameConfirm ? (
              <label className="flex items-center gap-2 text-xs text-amber-800">
                <Checkbox checked={confirmed.name} onCheckedChange={function (v) { setConfirmed(function (c) { return { ...c, name: Boolean(v) }; }); }} />
                I have checked this name against the document
              </label>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="document_number">{idLabelFor(form.document_type)}</Label>
            <Input id="document_number" className={lowField('number')} value={form.document_number} placeholder={form.document_type ? numberFormatHint(form.document_type) : 'Choose the document type first'} onChange={function (e) { setField('document_number', e.target.value); }} />
            {numberProblem ? <p className="text-xs text-rose-600">{numberProblem}</p> : null}
            {needsNumberConfirm ? (
              <label className="flex items-center gap-2 text-xs text-amber-800">
                <Checkbox checked={confirmed.number} onCheckedChange={function (v) { setConfirmed(function (c) { return { ...c, number: Boolean(v) }; }); }} />
                I have checked this number against the document
              </label>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-heading text-base font-semibold text-slate-900">3 · Where and when it was found</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="found_location">Where it was found</Label>
            <Input id="found_location" value={form.found_location} placeholder="For example: Kisumu bus park, near the matatu stage" onChange={function (e) { setField('found_location', e.target.value); }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date_found">Date found</Label>
            <Input id="date_found" type="date" max={today} value={form.date_found} onChange={function (e) { setField('date_found', e.target.value); }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pickup_point">Pickup point holding it</Label>
            <Select value={form.pickup_point_id} onValueChange={function (value) { setField('pickup_point_id', value); }} disabled={role === 'Officer'}>
              <SelectTrigger id="pickup_point"><SelectValue placeholder="Choose a verified pickup point" /></SelectTrigger>
              <SelectContent>
                {points.map(function (point) {
                  return <SelectItem key={point.id} value={point.id}>{point.name}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            {role === 'Officer' ? <p className="text-xs text-slate-500">Officers register documents for their own station only.</p> : null}
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <Button type="submit" className="gap-2 rounded-xl bg-blue-900 hover:bg-blue-950" disabled={!complete || submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Register found document
      </Button>
    </form>
  );
}

export default function ReportFound() {
  return (
    <RoleGuard allow={['Finder', 'Officer', 'Admin']}>
      <PageHeader title="Register a found document" description="Photograph the ID or certificate, record where it was found and which pickup point holds it." />
      <ReportFoundContent />
    </RoleGuard>
  );
}

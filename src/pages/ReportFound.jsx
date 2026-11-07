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
import FormField from '@/components/ui/form-field';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import useFieldErrors from '@/hooks/useFieldErrors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DOCUMENT_TYPES, documentTypeLabel, idLabelFor } from '@/lib/ldrs';
import { checkDocumentNumber, checkMaxLength, checkPastDate, checkPersonName, checkRequired, collectErrors, numberFormatHint, todayIso } from '@/lib/validation';
import { extractDocumentFields, LOW_CONFIDENCE } from '@/lib/ocr';
import { CheckCircle2, Loader2, ScanText, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMPTY = { document_type: '', owner_name: '', document_number: '', found_location: '', date_found: todayIso(), pickup_point_id: '' };

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
    base44.functions.invoke('listPublicPickupPoints').catch(function () { return []; }).then(function (list) {
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

  const needsNameConfirm = Boolean(ocr) && ocr.nameConfidence < LOW_CONFIDENCE && !confirmed.name;
  const needsNumberConfirm = Boolean(ocr) && (ocr.numberConfidence < LOW_CONFIDENCE || Boolean(ocr.numberProblem)) && !confirmed.number;
  const fields = useFieldErrors(
    collectErrors({
      document_type: () => checkRequired(form.document_type, 'Choose the type of document.'),
      photo: () => (photo.uri ? '' : 'Add a photograph of the document.'),
      owner_name: () => checkPersonName(form.owner_name) || (needsNameConfirm ? 'Confirm the name read by OCR against the document.' : ''),
      document_number: () =>
        (form.document_type ? checkDocumentNumber(form.document_type, form.document_number) : checkRequired(form.document_number, 'Enter the number printed on the document.')) ||
        (needsNumberConfirm ? 'Confirm the number read by OCR against the document.' : ''),
      found_location: () => checkRequired(form.found_location, 'Enter where the document was found.') || checkMaxLength(form.found_location, 200, 'The place'),
      date_found: () => checkPastDate(form.date_found, 'date found'),
      pickup_point: () => checkRequired(form.pickup_point_id, 'Choose the pickup point that holds the document.'),
    }),
  );

  const submit = async function (event) {
    event.preventDefault();
    if (!fields.submit()) return;
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
    fields.reset();
  };

  if (result) {
    return (
      <Card className="border-success-border">
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle text-success-subtle-foreground">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2>Document registered</h2>
              <p className="text-sm text-muted-foreground">
                {documentTypeLabel(result.document.document_type)} recorded at {result.pickup_point_name}.
                {role === 'Finder' ? ' Please hand the document in at this pickup point.' : ''}
              </p>
            </div>
          </div>
          {result.exact ? (
            <Alert tone="success">The number matches a loss report. The owner has been alerted with the pickup point and a reference code.</Alert>
          ) : result.fuzzy ? (
            <Alert tone="warning">{result.fuzzy} possible match(es) by name were sent to an officer for review.</Alert>
          ) : (
            <Alert tone="info">No loss report matches yet. The owner is matched automatically when they report it.</Alert>
          )}
          {result.duplicate_reasons.length ? (
            <Alert tone="warning" title="Flagged for an officer to check">
              <ul className="list-disc space-y-1 pl-5">
                {result.duplicate_reasons.map(function (reason) {
                  return <li key={reason}>{reason}</li>;
                })}
              </ul>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={reset}>Register another document</Button>
            <Button variant="secondary" asChild>
              <Link to={'/documents/' + result.document.id}>Open the record</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const ocrConfirm = function (kind, label) {
    return (
      <label className="flex items-center gap-2 text-sm text-warning-subtle-foreground">
        <Checkbox
          checked={confirmed[kind]}
          onCheckedChange={function (v) {
            setConfirmed(function (c) {
              return { ...c, [kind]: Boolean(v) };
            });
          }}
        />
        {label}
      </label>
    );
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-section">
      <Card as="section" aria-labelledby="found-step-1">
        <CardHeader>
          <CardTitle id="found-step-1">1. Document type and photograph</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-section pt-0 lg:grid-cols-2">
          <div className="space-y-4">
            <FormField id="document_type" label="Document type" error={fields.show('document_type')}>
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
            <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Before you photograph</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>Lay the document flat in good light, with the name and number readable.</li>
                <li>Do not post the photo anywhere else. LDRS stores it encrypted.</li>
                <li>Location data in the photo is removed automatically.</li>
              </ul>
            </div>
            <Button type="button" variant="secondary" className="w-full" disabled={!photo.file || !form.document_type || ocrState.busy} onClick={runOcr}>
              {ocrState.busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ScanText aria-hidden="true" />}
              Read name and number from the photograph
            </Button>
            {ocrState.message ? (
              <p aria-live="polite" className={cn('text-sm', ocrState.busy ? 'text-muted-foreground' : 'text-warning-subtle-foreground')}>
                {ocrState.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Photograph</p>
            <PhotoUpload
              id="photo"
              fileUri={photo.uri}
              invalid={Boolean(fields.show('photo'))}
              describedBy={fields.show('photo') ? 'photo-error' : undefined}
              onChange={function (uri, meta) {
                setPhoto({ uri, sha256: meta.sha256, phash: meta.phash, file: meta.file });
                setOcr(null);
              }}
            />
            {fields.show('photo') ? (
              <p id="photo-error" className="text-xs font-medium text-danger-subtle-foreground">
                {fields.show('photo')}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card as="section" aria-labelledby="found-step-2">
        <CardHeader>
          <CardTitle id="found-step-2">2. Details on the document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {ocr ? (
            <Alert tone="info" icon={Sparkles}>
              OCR read the fields below (name {ocr.nameConfidence}% sure, number {ocr.numberConfidence}% sure). Compare anything it was unsure
              about with the document and confirm it.
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FormField id="owner_name" label="Name on the document" hint="As printed, for example JANE AKINYI OTIENO." error={fields.show('owner_name')}>
                <Input value={form.owner_name} autoComplete="off" onBlur={fields.touch('owner_name')} onChange={function (e) { setField('owner_name', e.target.value); }} />
              </FormField>
              {needsNameConfirm ? ocrConfirm('name', 'I have checked this name against the document') : null}
            </div>
            <div className="space-y-2">
              <FormField
                id="document_number"
                label={idLabelFor(form.document_type)}
                hint={form.document_type ? 'Format: ' + numberFormatHint(form.document_type) + '.' : 'Choose the document type first.'}
                error={fields.show('document_number')}
              >
                <Input value={form.document_number} autoComplete="off" onBlur={fields.touch('document_number')} onChange={function (e) { setField('document_number', e.target.value); }} />
              </FormField>
              {needsNumberConfirm ? ocrConfirm('number', 'I have checked this number against the document') : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card as="section" aria-labelledby="found-step-3">
        <CardHeader>
          <CardTitle id="found-step-3">3. Where and when it was found</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0 sm:grid-cols-2">
          <FormField id="found_location" label="Where it was found" error={fields.show('found_location')} className="sm:col-span-2">
            <Input
              value={form.found_location}
              placeholder="For example: Kisumu bus park, near the matatu stage"
              onBlur={fields.touch('found_location')}
              onChange={function (e) { setField('found_location', e.target.value); }}
            />
          </FormField>
          <FormField id="date_found" label="Date found" error={fields.show('date_found')}>
            <Input type="date" max={todayIso()} value={form.date_found} onBlur={fields.touch('date_found')} onChange={function (e) { setField('date_found', e.target.value); }} />
          </FormField>
          <FormField
            id="pickup_point"
            label="Pickup point holding it"
            hint={role === 'Officer' ? 'Officers register documents for their own station only.' : undefined}
            error={fields.show('pickup_point')}
          >
            <Select value={form.pickup_point_id} onValueChange={function (value) { setField('pickup_point_id', value); }} disabled={role === 'Officer'}>
              <SelectTrigger onBlur={fields.touch('pickup_point')}>
                <SelectValue placeholder="Choose a verified pickup point" />
              </SelectTrigger>
              <SelectContent>
                {points.map(function (point) {
                  return (
                    <SelectItem key={point.id} value={point.id}>
                      {point.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FormField>
        </CardContent>
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
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

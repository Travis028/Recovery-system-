import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useFieldErrors from '@/hooks/useFieldErrors';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import FormField from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CaptchaPrompt from '@/components/security/CaptchaPrompt';
import { useToast } from '@/components/ui/use-toast';
import { DOCUMENT_TYPES, documentTypeLabel, formatDate } from '@/lib/ldrs';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit';
import { checkKenyanPhone, checkMaxLength, checkPersonName, collectErrors } from '@/lib/validation';
import { cn } from '@/lib/utils';

/**
 * Lets an owner claim a document that has been handed in. The list comes from the same
 * masked, rate-limited search as the Search screen, so the owner never receives the full
 * name or number of a document before an officer checks the claim.
 */
export default function ClaimDocumentDialog({ open, onOpenChange, user, onClaimed, initialDocument }) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [type, setType] = useState('any');
  const [query, setQuery] = useState('');
  const [captcha, setCaptcha] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selected = documents.find(function (doc) {
    return doc.id === selectedId;
  });
  const fields = useFieldErrors(
    collectErrors({
      claim_document: () => (selected ? '' : 'Search for the document and choose it from the list.'),
      claim_name: () => checkPersonName(ownerName),
      claim_phone: () => checkKenyanPhone(phone),
      claim_note: () => checkMaxLength(note, 500, 'The note'),
    }),
  );
  const { reset: resetFields } = fields;

  useEffect(
    function () {
      if (!open) return;
      setError('');
      setQuery('');
      setType('any');
      setCaptcha(null);
      setSearched(Boolean(initialDocument));
      setDocuments(initialDocument ? [initialDocument] : []);
      setSelectedId(initialDocument ? initialDocument.id : '');
      setOwnerName(user.full_name || '');
      setPhone(user.phone || '');
      setDocumentNumber('');
      setNote('');
      resetFields();
    },
    [open, user.full_name, user.phone, initialDocument, resetFields],
  );

  const runSearch = async function (captchaAnswer) {
    const term = String(query || '').trim();
    setSearching(true);
    setError('');
    try {
      const looksLikeNumber = /\d/.test(term);
      const result = await base44.functions.invoke('searchFoundDocuments', {
        document_type: type === 'any' ? '' : type,
        name: looksLikeNumber ? '' : term,
        number: looksLikeNumber ? term : '',
        captcha_id: captchaAnswer ? captchaAnswer.id : undefined,
        captcha_answer: captchaAnswer ? captchaAnswer.answer : undefined,
      });
      setDocuments(result.results);
      setSearched(true);
      setCaptcha(null);
    } catch (searchError) {
      if (searchError.code === 'captcha_required') {
        setCaptcha(await base44.functions.invoke('getCaptcha').catch(() => null));
      }
      setError(searchError.message || 'The search could not be completed.');
    } finally {
      setSearching(false);
    }
  };

  const submit = async function (event) {
    event.preventDefault();
    if (!fields.submit()) return;
    setSubmitting(true);
    setError('');
    try {
      const existing = await base44.entities.Claim.filter({ document_id: selected.id, owner_user_id: user.id, status: { $in: ['Pending', 'Approved'] } }, { limit: 1 });
      if (existing.length) {
        setError('You have already claimed this document. Watch your alerts for the officer decision.');
        return;
      }
      await base44.entities.Claim.create({
        document_id: selected.id,
        document_type: selected.document_type,
        owner_user_id: user.id,
        owner_name: ownerName.trim(),
        phone: phone.trim(),
        document_number: documentNumber.trim(),
        note: note.trim(),
        status: 'Pending',
      });
      await logAction({
        action: AUDIT_ACTIONS.CLAIM_SUBMITTED,
        details: 'Claim submitted for a ' + documentTypeLabel(selected.document_type) + ' (' + selected.document_number + ')',
        user,
      });
      toast({ tone: 'success', title: 'Claim sent', description: 'An officer at the pickup point will check it and you will get an alert.' });
      onClaimed();
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError.message || 'The claim could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Claim a document</DialogTitle>
          <DialogDescription>Choose a document that has been handed in and belongs to you. An officer checks your claim before it is released.</DialogDescription>
        </DialogHeader>

        <form
          role="search"
          className="grid gap-3 sm:grid-cols-[12rem_1fr_auto]"
          onSubmit={function (event) {
            event.preventDefault();
            runSearch();
          }}
        >
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label="Document type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any document type</SelectItem>
              {DOCUMENT_TYPES.map(function (item) {
                return (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <SearchInput id="claim_query" label="Full name or document number" value={query} placeholder="Full name or document number" onChange={function (event) { setQuery(event.target.value); }} />
          <Button type="submit" variant="secondary" disabled={searching || String(query).trim().length < 3}>
            {searching ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Search
          </Button>
        </form>

        {captcha ? <CaptchaPrompt captcha={captcha} busy={searching} onAnswer={function (answer) { runSearch({ id: captcha.captcha_id, answer }); }} /> : null}

        <div id="claim_document" tabIndex={-1} className="outline-none">
          {searched ? (
            documents.length ? (
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1" aria-label="Documents found">
                {documents.map(function (doc) {
                  const active = doc.id === selectedId;
                  return (
                    <li key={doc.id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={function () {
                          setSelectedId(doc.id);
                          setError('');
                        }}
                        className={cn(
                          'w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          active ? 'border-primary bg-primary-subtle' : 'border-border hover:bg-muted',
                        )}
                      >
                        <p className="text-sm font-medium">{documentTypeLabel(doc.document_type)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {doc.owner_name} · <span className="font-mono">{doc.document_number}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Found at {doc.found_location} on {formatDate(doc.date_found)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-md border border-dashed border-border-strong bg-muted/50 p-4 text-sm text-muted-foreground">No held document matches this search. Try another name or number.</p>
            )
          ) : (
            <p className="rounded-md border border-dashed border-border-strong bg-muted/50 p-4 text-sm text-muted-foreground">
              Search with the full name on the document or its number. Results show partly hidden details only.
            </p>
          )}
          {fields.show('claim_document') ? <p className="mt-1.5 text-xs font-medium text-danger-subtle-foreground">{fields.show('claim_document')}</p> : null}
        </div>

        <form className="space-y-4" onSubmit={submit} noValidate>
          {selected ? (
            <Alert tone="info">
              Claiming: {documentTypeLabel(selected.document_type)} found at {selected.found_location} on {formatDate(selected.date_found)}.
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="claim_name" label="Full name on the document" error={fields.show('claim_name')}>
              <Input value={ownerName} autoComplete="name" onBlur={fields.touch('claim_name')} onChange={function (event) { setOwnerName(event.target.value); }} />
            </FormField>
            <FormField id="claim_phone" label="Your phone number" error={fields.show('claim_phone')}>
              <Input value={phone} type="tel" autoComplete="tel" placeholder="0712 345 678" onBlur={fields.touch('claim_phone')} onChange={function (event) { setPhone(event.target.value); }} />
            </FormField>
          </div>
          <FormField id="claim_number" label="Number on the document" optional hint="It helps the officer confirm the document is yours.">
            <Input value={documentNumber} autoComplete="off" onChange={function (event) { setDocumentNumber(event.target.value); }} />
          </FormField>
          <FormField id="claim_note" label="Anything that proves it is yours" optional error={fields.show('claim_note')}>
            <Textarea
              value={note}
              placeholder="For example: my photo is on it and I lost it at the market in Eldoret."
              onBlur={fields.touch('claim_note')}
              onChange={function (event) {
                setNote(event.target.value);
              }}
            />
          </FormField>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <DialogFooter>
            <Button type="button" variant="secondary" disabled={submitting} onClick={function () { onOpenChange(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Send claim
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

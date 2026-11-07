import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CaptchaPrompt from '@/components/security/CaptchaPrompt';
import { DOCUMENT_TYPES, documentTypeLabel, formatDate, isValidKenyanPhone } from '@/lib/ldrs';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit';
import { Loader2, Search } from 'lucide-react';

/**
 * Lets an owner claim a document that has been handed in. The list comes from the same
 * masked, rate-limited search as the Search screen — the owner never receives the full
 * name or number of a document before an officer verifies the claim.
 */
export default function ClaimDocumentDialog({ open, onOpenChange, user, onClaimed, initialDocument }) {
  const [documents, setDocuments] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');
  const [captcha, setCaptcha] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(
    function () {
      if (!open) return;
      setError('');
      setQuery('');
      setType('');
      setCaptcha(null);
      setSearched(Boolean(initialDocument));
      setDocuments(initialDocument ? [initialDocument] : []);
      setSelectedId(initialDocument ? initialDocument.id : '');
      setOwnerName(user.full_name || '');
      setPhone(user.phone || '');
      setDocumentNumber('');
      setNote('');
    },
    [open, user.full_name, user.phone, initialDocument],
  );

  const runSearch = async function (captchaAnswer) {
    const term = String(query || '').trim();
    setSearching(true);
    setError('');
    try {
      const looksLikeNumber = /\d/.test(term);
      const result = await base44.functions.invoke('searchFoundDocuments', {
        document_type: type,
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
        setCaptcha(await base44.functions.invoke('getCaptcha'));
      }
      setError(searchError.message || 'The search could not be completed.');
    } finally {
      setSearching(false);
    }
  };

  const selected = documents.find(function (doc) {
    return doc.id === selectedId;
  });

  const submit = async function (event) {
    event.preventDefault();
    if (!selected) {
      setError('Choose the document you are claiming first.');
      return;
    }
    if (String(ownerName).trim().length < 2) {
      setError('Enter the full name shown on the document.');
      return;
    }
    if (!isValidKenyanPhone(phone)) {
      setError('Enter a valid Kenyan phone number, for example 0712345678.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const existing = await base44.entities.Claim.filter(
        { document_id: selected.id, owner_user_id: user.id, status: { $in: ['Pending', 'Approved'] } },
        { limit: 1 },
      );
      if ((existing.items || []).length) {
        setError('You have already claimed this document. Watch your alerts for the officer decision.');
        return;
      }

      await base44.entities.Claim.create({
        document_id: selected.id,
        document_type: selected.document_type,
        owner_user_id: user.id,
        owner_name: String(ownerName).trim(),
        phone: String(phone).trim(),
        document_number: String(documentNumber).trim(),
        note: String(note).trim(),
        status: 'Pending',
      });

      await logAction({
        action: AUDIT_ACTIONS.CLAIM_SUBMITTED,
        details: 'Claim submitted for a ' + documentTypeLabel(selected.document_type) + ' (' + selected.document_number + ')',
        user,
      });

      onClaimed();
      onOpenChange(false);
    } catch (submitError) {
      console.error('Claim could not be submitted', submitError);
      setError(submitError.message || 'The claim could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Claim a document</DialogTitle>
          <DialogDescription>
            Choose a document that has been handed in and belongs to you. An officer will check your claim before the
            document is released.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={function (event) {
            event.preventDefault();
            runSearch();
          }}
        >
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="claim_type">
              <SelectValue placeholder="Any document type" />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map(function (item) {
                return (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="claim_query"
              value={query}
              className="pl-9"
              placeholder="Full name or document number"
              onChange={function (event) {
                setQuery(event.target.value);
              }}
            />
          </div>
          <Button type="submit" variant="outline" className="rounded-xl" disabled={searching || String(query).trim().length < 3}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Search
          </Button>
        </form>

        {captcha ? (
          <CaptchaPrompt
            captcha={captcha}
            onAnswer={function (answer) {
              runSearch({ id: captcha.captcha_id, answer });
            }}
          />
        ) : null}

        {searched ? (
          documents.length ? (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {documents.map(function (doc) {
                const active = doc.id === selectedId;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={function () {
                      setSelectedId(doc.id);
                      setError('');
                    }}
                    className={
                      active
                        ? 'w-full rounded-xl border border-blue-900 bg-blue-50 p-3 text-left'
                        : 'w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-blue-300'
                    }
                  >
                    <p className="font-heading text-sm font-semibold text-slate-900">{documentTypeLabel(doc.document_type)}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {doc.owner_name} | {doc.document_number}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Found at {doc.found_location} on {formatDate(doc.date_found)}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No held document matches this search. Try another name or number.
            </p>
          )
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Search with the full name on the document or its number. Results show partly hidden details only.
          </p>
        )}

        <form className="space-y-3" onSubmit={submit}>
          {selected ? (
            <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900">
              Claiming: {documentTypeLabel(selected.document_type)} found at {selected.found_location} on{' '}
              {formatDate(selected.date_found)}.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="claim_name">Full name on the document</Label>
              <Input
                id="claim_name"
                value={ownerName}
                placeholder="Example: Mary Wanjiru"
                onChange={function (event) {
                  setOwnerName(event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim_phone">Your phone number</Label>
              <Input
                id="claim_phone"
                value={phone}
                placeholder="Example: 0712345678"
                onChange={function (event) {
                  setPhone(event.target.value);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="claim_number">Number on the document (optional)</Label>
            <Input
              id="claim_number"
              value={documentNumber}
              placeholder="The number printed on your document"
              onChange={function (event) {
                setDocumentNumber(event.target.value);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="claim_note">Anything that proves it is yours (optional)</Label>
            <Textarea
              id="claim_note"
              value={note}
              placeholder="Example: My photo is on it and I lost it at the market in Eldoret."
              onChange={function (event) {
                setNote(event.target.value);
              }}
            />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={submitting}
              onClick={function () {
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="gap-2 rounded-xl bg-blue-900 hover:bg-blue-950" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit claim
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

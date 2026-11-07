import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
import { documentTypeLabel, formatDate, maskDocumentNumber } from '@/lib/ldrs';
import { CheckCheck, Loader2, XCircle } from 'lucide-react';

export default function ClaimCard({ claim, document: doc, busy, onApprove, onReject }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-semibold text-slate-900">
            {documentTypeLabel(doc ? doc.document_type : claim.document_type)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {doc ? doc.owner_name : 'Name not recorded'}
            <span className="mx-2 text-slate-300">|</span>
            {doc ? doc.document_number : maskDocumentNumber(claim.document_number)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Claimed by {claim.owner_name} | {claim.phone} | Submitted {formatDate(claim.created_date)}
          </p>
          {claim.document_number ? (
            <p className="mt-1 text-xs text-slate-500">Number given by the claimant: {claim.document_number}</p>
          ) : null}
          {claim.note ? <p className="mt-2 text-sm text-slate-600">{claim.note}</p> : null}
        </div>
        <StatusBadge status={claim.status} kind="claim" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700"
          disabled={busy}
          onClick={function () {
            onApprove(claim);
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
          Approve claim
        </Button>
        <Button
          variant="outline"
          className="gap-2 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
          disabled={busy}
          onClick={function () {
            onReject(claim);
          }}
        >
          <XCircle className="h-4 w-4" />
          Reject claim
        </Button>
      </div>
    </div>
  );
}

import StatusBadge from '@/components/StatusBadge';
import { documentTypeLabel, formatDate, maskDocumentNumber } from '@/lib/ldrs';

export default function MyClaims({ claims }) {
  return (
    <div className="space-y-3">
      {claims.map(function (claim) {
        return (
          <div key={claim.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-heading text-sm font-semibold text-slate-900">
                  {documentTypeLabel(claim.document_type)}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {maskDocumentNumber(claim.document_number)} | Claim sent {formatDate(claim.created_date)}
                </p>
                {claim.status === 'Approved' && claim.reference_code ? (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    Approved — reference code {claim.reference_code}
                  </p>
                ) : null}
                {claim.status === 'Pending' ? (
                  <p className="mt-1 text-xs text-slate-500">
                    An officer is checking your claim. You will be alerted when a decision is made.
                  </p>
                ) : null}
                {claim.status === 'Rejected' ? (
                  <p className="mt-1 text-xs text-rose-600">
                    Not approved. Visit the pickup point with proof of ownership.
                  </p>
                ) : null}
              </div>
              <StatusBadge status={claim.status} kind="claim" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

import StatusBadge from '@/components/StatusBadge';
import { documentTypeLabel, formatDate, maskDocumentNumber } from '@/lib/ldrs';

const NEXT_STEP = {
  Pending: 'An officer is checking your claim. You will get an alert with the decision.',
  Rejected: 'Not approved. Visit the pickup point with proof of ownership.',
};

export default function MyClaims({ claims }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card shadow-sm">
      {claims.map(function (claim) {
        return (
          <li key={claim.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{documentTypeLabel(claim.document_type)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {maskDocumentNumber(claim.document_number)} · claimed {formatDate(claim.created_date)}
              </p>
              {claim.status === 'Approved' && claim.reference_code ? (
                <p className="mt-1 text-sm text-success-subtle-foreground">
                  Approved. Reference code <span className="font-mono font-semibold">{claim.reference_code}</span>
                </p>
              ) : null}
              {NEXT_STEP[claim.status] ? <p className="mt-1 text-sm text-muted-foreground">{NEXT_STEP[claim.status]}</p> : null}
            </div>
            <StatusBadge status={claim.status} kind="claim" />
          </li>
        );
      })}
    </ul>
  );
}

import { CheckCheck, Loader2, XCircle } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { documentTypeLabel, formatDate, maskDocumentNumber } from '@/lib/ldrs';

export default function ClaimCard({ claim, document: doc, busy, onApprove, onReject }) {
  const label = documentTypeLabel(doc ? doc.document_type : claim.document_type);
  return (
    <Card as="article" aria-label={'Claim for ' + label}>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {doc ? doc.owner_name : 'Name not recorded'} ·{' '}
              <span className="font-mono">{doc ? doc.document_number : maskDocumentNumber(claim.document_number)}</span>
            </p>
          </div>
          <StatusBadge status={claim.status} kind="claim" />
        </div>
        <dl className="grid gap-3 rounded-md bg-muted p-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Claimed by</dt>
            <dd className="font-medium">{claim.owner_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Phone</dt>
            <dd className="font-mono">{claim.phone}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Submitted</dt>
            <dd>{formatDate(claim.created_date)}</dd>
          </div>
          {claim.document_number ? (
            <div className="sm:col-span-3">
              <dt className="text-xs text-muted-foreground">Number given by the claimant</dt>
              <dd className="font-mono">{claim.document_number}</dd>
            </div>
          ) : null}
          {claim.note ? (
            <div className="sm:col-span-3">
              <dt className="text-xs text-muted-foreground">Proof of ownership</dt>
              <dd>{claim.note}</dd>
            </div>
          ) : null}
        </dl>
      </CardContent>
      <CardFooter>
        <Button variant="success" disabled={busy} onClick={function () { onApprove(claim); }}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}
          Approve claim
        </Button>
        <Button variant="danger-outline" disabled={busy} onClick={function () { onReject(claim); }}>
          <XCircle aria-hidden="true" />
          Reject claim
        </Button>
      </CardFooter>
    </Card>
  );
}

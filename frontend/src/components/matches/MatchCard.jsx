import { Link } from 'react-router-dom';
import { BellRing, CheckCheck, KeyRound, Loader2, XCircle } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { documentTypeLabel, formatDate, maskDocumentNumber, normalizeId } from '@/lib/ldrs';

function Side({ title, name, number, meta }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{name || 'Name not recorded'}</p>
      <p className="font-mono text-xs text-muted-foreground">{number}</p>
      {meta ? <p className="mt-1 text-xs text-muted-foreground">{meta}</p> : null}
    </div>
  );
}

export default function MatchCard({ match, document: doc, report, pickupPointName, canReview, busy, onConfirm, onReject, onNotify }) {
  const sameNumber = doc && report && normalizeId(doc.document_number) === normalizeId(report.document_number);
  const label = documentTypeLabel(doc ? doc.document_type : '');
  return (
    <Card as="article" aria-label={label + ' ' + match.match_type.toLowerCase() + ' match'}>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">
              {label} · {match.match_type} match · score {match.match_score}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {pickupPointName ? 'Held at ' + pickupPointName + ' · ' : ''}
              Created {formatDate(match.created_date)}
              {match.reference_code ? (
                <>
                  {' · Reference '}
                  <span className="font-mono">{match.reference_code}</span>
                </>
              ) : null}
            </p>
          </div>
          <StatusBadge status={match.match_status} kind="match" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Side
            title="Found document"
            name={doc ? doc.owner_name : ''}
            number={doc ? maskDocumentNumber(doc.document_number) : ''}
            meta={doc ? 'Found at ' + doc.found_location + ' on ' + formatDate(doc.date_found) : ''}
          />
          <Side
            title="Loss report"
            name={report ? report.owner_name : 'Report not visible'}
            number={report ? maskDocumentNumber(report.document_number) : ''}
            meta={report ? 'Lost on ' + formatDate(report.date_lost) : ''}
          />
        </div>
        {match.match_type === 'Fuzzy' && match.match_status === 'Pending' ? (
          <Alert tone={sameNumber ? 'info' : 'warning'}>
            {sameNumber ? 'The numbers agree.' : 'The numbers differ. Check the photograph and ask the owner for proof before confirming.'}
          </Alert>
        ) : null}
      </CardContent>

      {canReview && (match.match_status === 'Pending' || match.match_status === 'Confirmed') ? (
        <CardFooter>
          {match.match_status === 'Pending' ? (
            <Button variant="success" disabled={busy} onClick={function () { onConfirm(match); }}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}
              Confirm match
            </Button>
          ) : (
            <>
              <Button asChild>
                <Link to={'/handover/' + match.id}>
                  <KeyRound aria-hidden="true" />
                  Start handover
                </Link>
              </Button>
              <Button variant="secondary" disabled={busy} onClick={function () { onNotify(match); }}>
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <BellRing aria-hidden="true" />}
                Remind owner
              </Button>
            </>
          )}
          <Button variant="danger-outline" disabled={busy} onClick={function () { onReject(match); }}>
            <XCircle aria-hidden="true" />
            Reject
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

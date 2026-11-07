import { Link } from 'react-router-dom';
import { BellRing, CheckCheck, KeyRound, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
import { documentTypeLabel, formatDate, maskDocumentNumber, normalizeId } from '@/lib/ldrs';

function Side({ title, name, number, meta }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{name || 'Name not recorded'}</p>
      <p className="text-xs text-slate-600">{number}</p>
      {meta ? <p className="mt-1 text-xs text-slate-500">{meta}</p> : null}
    </div>
  );
}

export default function MatchCard({ match, document: doc, report, pickupPointName, canReview, busy, onConfirm, onReject, onNotify }) {
  const sameNumber = doc && report && normalizeId(doc.document_number) === normalizeId(report.document_number);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-semibold text-slate-900">
            {documentTypeLabel(doc ? doc.document_type : '')} · {match.match_type} match · score {match.match_score}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {pickupPointName ? 'Held at ' + pickupPointName + ' · ' : ''}Created {formatDate(match.created_date)}
            {match.reference_code ? ' · Reference ' + match.reference_code : ''}
          </p>
        </div>
        <StatusBadge status={match.match_status} kind="match" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
      {match.match_type === 'Fuzzy' ? (
        <p className="mt-2 text-xs text-amber-700">
          {sameNumber ? 'Numbers agree.' : 'The numbers differ — check the photograph and ask the owner for proof before confirming.'}
        </p>
      ) : null}

      {canReview ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {match.match_status === 'Pending' ? (
            <>
              <Button className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={function () { onConfirm(match); }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                Confirm match
              </Button>
              <Button variant="outline" className="gap-2 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" disabled={busy} onClick={function () { onReject(match); }}>
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </>
          ) : null}
          {match.match_status === 'Confirmed' ? (
            <>
              <Button className="gap-2 rounded-xl bg-blue-900 hover:bg-blue-950" asChild>
                <Link to={'/handover/' + match.id}>
                  <KeyRound className="h-4 w-4" />
                  Start handover
                </Link>
              </Button>
              <Button variant="outline" className="gap-2 rounded-xl" disabled={busy} onClick={function () { onNotify(match); }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                Remind owner
              </Button>
              <Button variant="outline" className="gap-2 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" disabled={busy} onClick={function () { onReject(match); }}>
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, MapPin } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { documentTypeLabel, formatDate, maskDocumentNumber, maskName } from '@/lib/ldrs';

/** One document in a list. Names and numbers stay hidden until the record is opened. */
export default function DocumentRow({ document: doc, pickupPointName, mask = true }) {
  return (
    <Link
      to={'/documents/' + doc.id}
      className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-heading text-sm font-semibold text-slate-900">{documentTypeLabel(doc.document_type)}</p>
          {doc.duplicate_flag ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              Possible duplicate
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-sm text-slate-600">
          {mask ? maskName(doc.owner_name) : doc.owner_name}
          <span className="mx-2 text-slate-300">|</span>
          {mask ? maskDocumentNumber(doc.document_number) : doc.document_number}
        </p>
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {doc.found_location} · found {formatDate(doc.date_found)}
          {pickupPointName ? ' · held at ' + pickupPointName : ''}
        </p>
      </div>
      <StatusBadge status={doc.status} />
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
    </Link>
  );
}

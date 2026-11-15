import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, MapPin } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { documentTypeLabel, formatDate, maskDocumentNumber, maskName } from '@/lib/ldrs';

/** One document in a short list. Names and numbers stay hidden until the record is opened. */
export default function DocumentRow({ document: doc, pickupPointName }) {
  return (
    <li>
      <Link
        to={'/documents/' + doc.id}
        className="flex items-center gap-4 px-card py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{documentTypeLabel(doc.document_type)}</p>
            {doc.duplicate_flag ? (
              <Badge tone="warning">
                <AlertTriangle aria-hidden="true" />
                Possible duplicate
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {maskName(doc.owner_name)} · {maskDocumentNumber(doc.document_number)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {doc.found_location} · {formatDate(doc.date_found)}
              {pickupPointName ? ' · ' + pickupPointName : ''}
            </span>
          </p>
        </div>
        <StatusBadge status={doc.status} />
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

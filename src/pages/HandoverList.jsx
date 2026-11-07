import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import Loader from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { documentTypeLabel, formatDateTime, maskDocumentNumber, maskName } from '@/lib/ldrs';
import { FileCheck2, KeyRound, ReceiptText } from 'lucide-react';

function HandoverListContent() {
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState([]);
  const [done, setDone] = useState([]);
  const [docs, setDocs] = useState({});

  useEffect(function () {
    const load = async function () {
      const [confirmed, handovers] = await Promise.all([
        base44.entities.Match.filter({ match_status: 'Confirmed' }, { sort: '-created_date', limit: 100 }),
        base44.entities.Handover.filter({}, { sort: '-created_date', limit: 50 }),
      ]);
      const ids = [...new Set(confirmed.map(function (m) { return m.document_id; }).concat(handovers.map(function (h) { return h.document_id; })))];
      const map = {};
      if (ids.length) {
        (await base44.entities.Document.filter({ id: { $in: ids } })).forEach(function (doc) { map[doc.id] = doc; });
      }
      setWaiting(confirmed);
      setDone(handovers);
      setDocs(map);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <Loader label="Loading handovers" />;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold text-slate-900">Awaiting collection</h2>
        {waiting.length ? (
          <div className="space-y-3">
            {waiting.map(function (match) {
              const doc = docs[match.document_id];
              return (
                <div key={match.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-sm font-semibold text-slate-900">{doc ? documentTypeLabel(doc.document_type) : 'Document'}</p>
                    <p className="mt-1 text-sm text-slate-600">{doc ? maskName(doc.owner_name) + ' | ' + maskDocumentNumber(doc.document_number) : ''}</p>
                    <p className="mt-1 text-xs text-slate-500">Reference {match.reference_code} · confirmed {formatDateTime(match.updated_date)}</p>
                  </div>
                  <Button className="gap-2 rounded-xl bg-blue-900 hover:bg-blue-950" asChild>
                    <Link to={'/handover/' + match.id}><KeyRound className="h-4 w-4" />Start handover</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={KeyRound} title="Nobody is waiting to collect" description="Confirmed matches appear here when the owner can collect." />
        )}
      </section>
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold text-slate-900">Completed handovers (read-only)</h2>
        {done.length ? (
          <div className="space-y-3">
            {done.map(function (handover) {
              const doc = docs[handover.document_id];
              return (
                <div key={handover.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <FileCheck2 className="h-5 w-5 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-sm font-semibold text-slate-900">{doc ? documentTypeLabel(doc.document_type) : 'Document'} · released to {handover.released_to}</p>
                    <p className="mt-1 text-xs text-slate-500">Receipt {handover.id.slice(0, 8).toUpperCase()} · {formatDateTime(handover.released_at || handover.created_date)}</p>
                  </div>
                  <Button variant="outline" className="gap-2 rounded-xl" asChild>
                    <Link to={'/receipt/' + handover.id}><ReceiptText className="h-4 w-4" />Receipt</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={ReceiptText} title="No handovers yet" description="Each release creates a permanent receipt." />
        )}
      </section>
    </div>
  );
}

export default function HandoverList() {
  return (
    <RoleGuard allow={['Officer', 'Admin']}>
      <PageHeader title="Handover" description="Release documents to their owners after verifying identity, and reprint receipts." />
      <HandoverListContent />
    </RoleGuard>
  );
}

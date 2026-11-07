import { Link } from 'react-router-dom';
import { KeyRound, ReceiptText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useResource from '@/hooks/useResource';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import DataTable from '@/components/data-table/DataTable';
import { SkeletonRows } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { documentTypeLabel, formatDateTime, maskDocumentNumber, maskName } from '@/lib/ldrs';

async function loadHandovers() {
  const [waiting, done] = await Promise.all([
    base44.entities.Match.filter({ match_status: 'Confirmed' }, { sort: '-created_date', limit: 200 }),
    base44.entities.Handover.filter({}, { sort: '-created_date', limit: 500 }),
  ]);
  const ids = [...new Set(waiting.map((match) => match.document_id).concat(done.map((handover) => handover.document_id)))];
  const documents = {};
  if (ids.length) {
    (await base44.entities.Document.filter({ id: { $in: ids } })).forEach(function (doc) {
      documents[doc.id] = doc;
    });
  }
  return { waiting, done, documents };
}

function typeOf(documents, id) {
  return documents[id] ? documentTypeLabel(documents[id].document_type) : 'Document';
}

function HandoverListContent() {
  const { data, loading, error, reload } = useResource(loadHandovers, []);

  if (loading && !data) return <SkeletonRows label="Loading handovers" />;
  if (error) return <ErrorState title="Handovers could not be loaded" error={error} onRetry={reload} />;

  const { waiting, done, documents } = data;

  const waitingColumns = [
    {
      key: 'document',
      header: 'Document',
      sortValue: (match) => typeOf(documents, match.document_id),
      cell: function (match) {
        const doc = documents[match.document_id];
        return (
          <div>
            <p className="font-medium">{typeOf(documents, match.document_id)}</p>
            {doc ? <p className="text-xs text-muted-foreground">{maskName(doc.owner_name) + ' · ' + maskDocumentNumber(doc.document_number)}</p> : null}
          </div>
        );
      },
    },
    { key: 'reference', header: 'Reference', sortValue: (match) => match.reference_code, cell: (match) => <span className="font-mono">{match.reference_code}</span> },
    { key: 'confirmed', header: 'Confirmed', sortValue: (match) => match.updated_date, cell: (match) => <span className="whitespace-nowrap">{formatDateTime(match.updated_date)}</span> },
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      cell: function (match) {
        return (
          <Button size="sm" asChild>
            <Link to={'/handover/' + match.id}>
              <KeyRound aria-hidden="true" />
              Start handover
            </Link>
          </Button>
        );
      },
    },
  ];

  const doneColumns = [
    { key: 'document', header: 'Document', sortValue: (row) => typeOf(documents, row.document_id), cell: (row) => <span className="font-medium">{typeOf(documents, row.document_id)}</span> },
    { key: 'released_to', header: 'Released to', sortValue: (row) => row.released_to, cell: (row) => row.released_to },
    { key: 'receipt', header: 'Receipt', sortValue: (row) => row.id, cell: (row) => <span className="font-mono">{row.id.slice(0, 8).toUpperCase()}</span> },
    {
      key: 'released',
      header: 'Released',
      sortValue: (row) => row.released_at || row.created_date,
      cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.released_at || row.created_date)}</span>,
    },
    {
      key: 'action',
      header: <span className="sr-only">Receipt</span>,
      align: 'right',
      cell: function (row) {
        return (
          <Button variant="secondary" size="sm" asChild>
            <Link to={'/receipt/' + row.id} aria-label={'Open receipt ' + row.id.slice(0, 8).toUpperCase()}>
              <ReceiptText aria-hidden="true" />
              Receipt
            </Link>
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <section aria-labelledby="waiting-heading" className="space-y-3">
        <h2 id="waiting-heading">Awaiting collection</h2>
        <DataTable
          caption="Documents awaiting collection"
          columns={waitingColumns}
          rows={waiting}
          rowKey={(match) => match.id}
          initialSort={{ key: 'confirmed', direction: 'desc' }}
          emptyState={<EmptyState icon={KeyRound} title="Nobody is waiting to collect" description="Confirmed matches appear here when the owner can collect." />}
        />
      </section>
      <section aria-labelledby="done-heading" className="space-y-3">
        <h2 id="done-heading">Completed handovers</h2>
        <DataTable
          caption="Completed handovers"
          columns={doneColumns}
          rows={done}
          rowKey={(row) => row.id}
          initialSort={{ key: 'released', direction: 'desc' }}
          search={{ label: 'Search handovers', placeholder: 'Search by name or receipt number', text: (row) => row.released_to + ' ' + row.id }}
          emptyState={<EmptyState icon={ReceiptText} title="No handovers yet" description="Each release creates a permanent, read-only receipt." />}
        />
      </section>
    </div>
  );
}

export default function HandoverList() {
  return (
    <>
      <PageHeader title="Handover" description="Release documents to their owners after checking identity, and reprint receipts." />
      <HandoverListContent />
    </>
  );
}

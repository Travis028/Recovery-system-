import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, FilePlus, FolderOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import useResource from '@/hooks/useResource';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import StatusBadge from '@/components/StatusBadge';
import DataTable from '@/components/data-table/DataTable';
import FilterChips from '@/components/ui/filter-chips';
import { SkeletonRows } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DOCUMENT_STATUSES, documentTypeLabel, formatDate, maskDocumentNumber, maskName } from '@/lib/ldrs';

function DocumentsContent() {
  const { user, role } = useLdrsUser();
  const [status, setStatus] = useState('All');

  const { data, loading, error, reload } = useResource(
    async function () {
      const filter = {};
      if (role === 'Finder') filter.finder_user_id = user.id;
      const [documents, points] = await Promise.all([
        base44.entities.Document.filter(filter, { sort: '-created_date', limit: 500 }),
        base44.entities.PickupPoint.list(),
      ]);
      const pointNames = {};
      points.forEach(function (point) {
        pointNames[point.id] = point.name;
      });
      return { documents, pointNames };
    },
    [user.id, role],
  );

  if (loading && !data) return <SkeletonRows label="Loading documents" />;
  if (error) return <ErrorState title="Documents could not be loaded" error={error} onRetry={reload} />;

  const { documents, pointNames } = data;
  const canRegister = role === 'Finder' || role === 'Officer';

  if (!documents.length) {
    return (
      <EmptyState
        icon={FolderOpen}
        title={role === 'Finder' ? 'You have not registered any documents yet' : role === 'Officer' ? 'No documents are held at this station' : 'No documents recorded yet'}
        description={role === 'Finder' ? 'Documents you hand in at a pickup point are listed here.' : 'Documents registered at a pickup point are listed here.'}
        action={
          canRegister ? (
            <Button asChild>
              <Link to="/report-found">
                <FilePlus aria-hidden="true" />
                Register a found document
              </Link>
            </Button>
          ) : null
        }
      />
    );
  }

  const counts = { All: documents.length };
  documents.forEach(function (doc) {
    counts[doc.status] = (counts[doc.status] || 0) + 1;
  });
  const rows = status === 'All' ? documents : documents.filter(function (doc) {
    return doc.status === status;
  });

  const columns = [
    {
      key: 'type',
      header: 'Document',
      sortValue: function (doc) {
        return documentTypeLabel(doc.document_type);
      },
      cell: function (doc) {
        return (
          <div className="min-w-[10rem]">
            <Link to={'/documents/' + doc.id} className="font-medium text-foreground hover:text-primary hover:underline">
              {documentTypeLabel(doc.document_type)}
            </Link>
            {doc.duplicate_flag ? (
              <Badge tone="warning" className="ml-2">
                <AlertTriangle aria-hidden="true" />
                Possible duplicate
              </Badge>
            ) : null}
            <p className="text-xs text-muted-foreground">{maskName(doc.owner_name) + ' · ' + maskDocumentNumber(doc.document_number)}</p>
          </div>
        );
      },
    },
    {
      key: 'found',
      header: 'Found',
      sortValue: function (doc) {
        return doc.date_found;
      },
      cell: function (doc) {
        return (
          <div className="min-w-[10rem]">
            <p>{formatDate(doc.date_found)}</p>
            <p className="max-w-[16rem] truncate text-xs text-muted-foreground" title={doc.found_location}>
              {doc.found_location}
            </p>
          </div>
        );
      },
    },
    {
      key: 'point',
      header: 'Held at',
      sortValue: function (doc) {
        return pointNames[doc.pickup_point_id] || '';
      },
      cell: function (doc) {
        return <span className="whitespace-nowrap">{pointNames[doc.pickup_point_id] || '—'}</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: function (doc) {
        return doc.status;
      },
      cell: function (doc) {
        return <StatusBadge status={doc.status} />;
      },
    },
    {
      key: 'open',
      header: <span className="sr-only">Open</span>,
      align: 'right',
      cell: function (doc) {
        return (
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to={'/documents/' + doc.id} aria-label={'Open ' + documentTypeLabel(doc.document_type) + ' record'}>
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-3">
      <DataTable
        caption="Documents"
        columns={columns}
        rows={rows}
        rowKey={function (doc) {
          return doc.id;
        }}
        initialSort={{ key: 'found', direction: 'desc' }}
        search={{
          label: 'Search documents',
          placeholder: 'Search by name, number, place found or pickup point',
          text: function (doc) {
            return [doc.owner_name, doc.document_number, doc.found_location, documentTypeLabel(doc.document_type), pointNames[doc.pickup_point_id]].join(' ');
          },
        }}
        toolbar={
          <FilterChips
            label="Filter by status"
            value={status}
            onChange={setStatus}
            options={['All'].concat(DOCUMENT_STATUSES).map(function (item) {
              return { value: item, label: item === 'All' ? 'All' : item, count: counts[item] || 0 };
            })}
          />
        }
      />
      <p className="text-xs text-muted-foreground">
        Names and numbers are partly hidden in this list. Open a record to see the full details; opening it is recorded in the audit trail.
      </p>
    </div>
  );
}

export default function Documents() {
  const { role } = useLdrsUser();
  return (
    <RoleGuard allow={['Finder', 'Officer', 'Admin']}>
      <PageHeader
        title="Documents"
        description="Documents handed in at pickup points and their current status."
        actions={
          role === 'Finder' || role === 'Officer' ? (
            <Button asChild>
              <Link to="/report-found">
                <FilePlus aria-hidden="true" />
                Register found document
              </Link>
            </Button>
          ) : null
        }
      />
      <DocumentsContent />
    </RoleGuard>
  );
}

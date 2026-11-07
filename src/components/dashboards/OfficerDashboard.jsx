import { Link } from 'react-router-dom';
import { Archive, ClipboardCheck, FilePlus, FolderOpen, KeyRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useResource from '@/hooks/useResource';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Loader from '@/components/Loader';
import DocumentRow from '@/components/documents/DocumentRow';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

function DocumentList({ title, documents, empty }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      {documents.length ? (
        <ul className="divide-y divide-border border-t border-border">
          {documents.slice(0, 6).map(function (doc) {
            return <DocumentRow key={doc.id} document={doc} />;
          })}
        </ul>
      ) : (
        <div className="p-card pt-0">{empty}</div>
      )}
    </Card>
  );
}

/** Station dashboard: only this officer's station. Numbers stay hidden until a record is opened. */
export default function OfficerDashboard({ user }) {
  const { data, loading, error, reload } = useResource(
    function () {
      return Promise.all([
        base44.entities.Document.filter({}, { sort: '-created_date', limit: 200 }),
        base44.entities.Match.count({ match_status: 'Pending' }),
        base44.entities.Match.count({ match_status: 'Confirmed' }),
        base44.entities.Claim.count({ status: 'Pending' }),
        user.pickup_point_id
          ? base44.entities.PickupPoint.get(user.pickup_point_id).catch(function () {
              return null;
            })
          : null,
      ]);
    },
    [user.id, user.pickup_point_id],
  );

  if (loading && !data) return <Loader label="Loading the station dashboard" />;
  if (error) return <ErrorState title="The station dashboard could not be loaded" error={error} onRetry={reload} />;

  const [docs, pending, awaiting, claims, point] = data;
  const held = docs.filter(function (doc) {
    return doc.status !== 'Returned';
  });
  const unclaimed = docs.filter(function (doc) {
    return doc.status === 'Unclaimed';
  });
  const flagged = held.filter(function (doc) {
    return doc.duplicate_flag;
  });

  return (
    <div>
      <PageHeader
        title={point ? point.name : 'No station assigned'}
        description={user.full_name + '. You see only the documents held at this station. The session signs out after 15 minutes without activity.'}
        actions={
          <>
            <Button asChild>
              <Link to="/matches">
                <ClipboardCheck aria-hidden="true" />
                Review matches and claims
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/handover">
                <KeyRound aria-hidden="true" />
                Handover
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/report-found">
                <FilePlus aria-hidden="true" />
                Register a document
              </Link>
            </Button>
          </>
        }
      />
      <div className="space-y-section">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Documents held" value={held.length} icon={FolderOpen} tone="primary" />
          <StatCard label="Matches and claims to review" value={pending + claims} icon={ClipboardCheck} tone="warning" />
          <StatCard label="Awaiting collection" value={awaiting} icon={KeyRound} tone="success" />
          <StatCard label="Unclaimed" value={unclaimed.length} icon={Archive} tone="neutral" hint="Held longer than the retention setting" />
        </div>

        {flagged.length ? (
          <Alert tone="warning" title={flagged.length + (flagged.length === 1 ? ' document is' : ' documents are') + ' flagged as possible duplicates'}>
            Open each one to see why it was flagged before you match or release it.
          </Alert>
        ) : null}

        <div className="grid gap-section lg:grid-cols-2">
          <DocumentList
            title="Recently handed in"
            documents={held}
            empty={<EmptyState icon={FolderOpen} title="No documents held" description="Documents registered at this station appear here." />}
          />
          <DocumentList
            title="Unclaimed"
            documents={unclaimed}
            empty={
              <EmptyState
                icon={Archive}
                title="Nothing overdue"
                description="Documents not collected within the agreed period are listed here for hand-over to the registration authority."
              />
            }
          />
        </div>
      </div>
    </div>
  );
}

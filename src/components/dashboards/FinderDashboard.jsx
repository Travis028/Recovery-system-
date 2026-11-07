import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, FilePlus, FolderOpen, HeartHandshake } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useResource from '@/hooks/useResource';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Loader from '@/components/Loader';
import DocumentRow from '@/components/documents/DocumentRow';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

export default function FinderDashboard({ user }) {
  const { data, loading, error, reload } = useResource(
    function () {
      return Promise.all([
        base44.entities.Document.filter({ finder_user_id: user.id }, { sort: '-created_date', limit: 50 }),
        base44.entities.PickupPoint.list(),
      ]);
    },
    [user.id],
  );

  const header = (
    <PageHeader
      title={'Thank you, ' + (user.full_name || 'finder')}
      description="Photograph the document you found, record where you found it, and hand it in at a verified pickup point."
      actions={
        <>
          <Button asChild>
            <Link to="/report-found">
              <FilePlus aria-hidden="true" />
              Register a found document
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/pickup-points">
              <Building2 aria-hidden="true" />
              Pickup points
            </Link>
          </Button>
        </>
      }
    />
  );

  if (loading && !data) return <>{header}<Loader label="Loading your dashboard" /></>;
  if (error) return <>{header}<ErrorState title="Your dashboard could not be loaded" error={error} onRetry={reload} /></>;

  const [docs, points] = data;
  const pointName = function (id) {
    const point = points.find(function (item) {
      return item.id === id;
    });
    return point ? point.name : '';
  };
  const returned = docs.filter(function (doc) {
    return doc.status === 'Returned';
  }).length;

  return (
    <div>
      {header}
      <div className="space-y-section">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Documents handed in" value={docs.length} icon={FolderOpen} tone="primary" />
          <StatCard label="Returned to owners" value={returned} icon={CheckCircle2} tone="success" />
          <StatCard label="Waiting for owners" value={docs.length - returned} icon={HeartHandshake} tone="accent" />
        </div>
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle>Documents you handed in</CardTitle>
            {docs.length > 8 ? (
              <Button variant="link" size="sm" asChild>
                <Link to="/documents">See all</Link>
              </Button>
            ) : null}
          </CardHeader>
          {docs.length ? (
            <ul className="divide-y divide-border border-t border-border">
              {docs.slice(0, 8).map(function (doc) {
                return <DocumentRow key={doc.id} document={doc} pickupPointName={pointName(doc.pickup_point_id)} />;
              })}
            </ul>
          ) : (
            <div className="p-card pt-0">
              <EmptyState icon={FolderOpen} title="Nothing handed in yet" description="Documents you register are listed here with their status." />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

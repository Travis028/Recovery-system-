import { Link } from 'react-router-dom';
import { BellRing, Building2, FileWarning, ShieldCheck } from 'lucide-react';
import { api } from '@/api/client';
import useLdrsUser from '@/hooks/useLdrsUser';
import useResource from '@/hooks/useResource';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Loader from '@/components/Loader';
import StatusBadge from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DELIVERY_STATUS_LABELS, documentTypeLabel, formatDate, formatDateTime, maskDocumentNumber } from '@/lib/ldrs';

async function loadAlerts(userId) {
  const [alerts, matches, reports, points] = await Promise.all([
    api.entities.Notification.filter({ user_id: userId }, { sort: '-created_date', limit: 50 }),
    api.entities.Match.filter({ owner_user_id: userId, match_status: { $in: ['Confirmed', 'Returned'] } }, { sort: '-created_date', limit: 50 }),
    api.entities.LossReport.filter({ owner_user_id: userId }, { sort: '-created_date', limit: 50 }),
    api.entities.PickupPoint.filter({ active: true }, { sort: 'name', limit: 100 }),
  ]);
  const documentIds = matches.map((match) => match.document_id).filter(Boolean);
  const documentsById = {};
  if (documentIds.length) {
    (await api.entities.Document.filter({ id: { $in: documentIds } })).forEach(function (doc) {
      documentsById[doc.id] = doc;
    });
  }
  return { alerts, matches, reports, points, documentsById };
}

function AlertsContent() {
  const { user } = useLdrsUser();
  const { data, loading, error, reload } = useResource(() => loadAlerts(user.id), [user.id]);

  if (loading && !data) return <Loader label="Loading your alerts" />;
  if (error) return <ErrorState title="Your alerts could not be loaded" error={error} onRetry={reload} />;

  const { alerts, matches, reports, points, documentsById } = data;
  const pointName = function (id) {
    const point = points.find((item) => item.id === id);
    return point ? point.name + (point.location ? ', ' + point.location : '') : 'Shown in your alert message';
  };

  return (
    <div className="grid gap-section lg:grid-cols-[3fr_2fr]">
      <div className="space-y-section">
        <section aria-labelledby="collect-heading" className="space-y-3">
          <h2 id="collect-heading">Confirmed matches</h2>
          {matches.length ? (
            matches.map(function (match) {
              const doc = documentsById[match.document_id];
              const returned = match.match_status === 'Returned';
              return (
                <Card as="article" key={match.id} className={returned ? '' : 'border-success-border'}>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
                        {doc ? documentTypeLabel(doc.document_type) : 'Document'}
                      </h3>
                      <StatusBadge status={match.match_status} kind="match" />
                    </div>
                    <p className="text-sm">
                      Reference code <span className="font-mono font-semibold">{match.reference_code || 'in your alert'}</span>
                    </p>
                    <p className="flex items-start gap-2 text-sm">
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {returned ? 'Collected from ' : 'Collect from '}
                      {doc ? pointName(doc.pickup_point_id) : 'the pickup point in your alert'}
                    </p>
                    {returned ? null : (
                      <p className="text-sm text-muted-foreground">
                        Bring the document number with you. At the counter the officer creates a one-time collection code that appears on your
                        dashboard; show it to the officer to release the document.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <EmptyState icon={ShieldCheck} title="No confirmed match yet" description="When an officer confirms a match, the pickup point and your reference code appear here." />
          )}
        </section>

        <section aria-labelledby="alerts-heading" className="space-y-3">
          <h2 id="alerts-heading">Alerts sent to you</h2>
          {alerts.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card shadow-sm">
              {alerts.map(function (alert) {
                return (
                  <li key={alert.id} className="space-y-1.5 p-4">
                    <p className="text-sm">{alert.message}</p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {formatDateTime(alert.created_date)}
                      <Badge tone={alert.channel === 'SMS' ? 'info' : 'neutral'}>{alert.channel === 'SMS' ? 'SMS' : 'In the app'}</Badge>
                      {alert.channel === 'SMS' ? <span>{DELIVERY_STATUS_LABELS[alert.delivery_status] || alert.delivery_status}</span> : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={BellRing} title="No alerts yet" description="When a document matching your report is handed in, the alert appears here." />
          )}
        </section>
      </div>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>My lost reports</CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length ? (
            <ul className="divide-y divide-border">
              {reports.map(function (report) {
                return (
                  <li key={report.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{documentTypeLabel(report.document_type)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {maskDocumentNumber(report.document_number)} · lost {formatDate(report.date_lost)}
                      </p>
                    </div>
                    <StatusBadge status={report.status} kind="loss" />
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={FileWarning}
              title="No lost reports yet"
              description="Report your lost document to start receiving alerts."
              className="border-0 py-6"
              action={
                <Button size="sm" asChild>
                  <Link to="/report-lost">Report a lost document</Link>
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OwnerAlerts() {
  return (
    <>
      <PageHeader title="Alerts" description="Alerts about your documents, where to collect them, and the status of each report." />
      <AlertsContent />
    </>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, ClipboardCheck, FileSearch, FileWarning, KeyRound, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useResource from '@/hooks/useResource';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Loader from '@/components/Loader';
import StatusBadge from '@/components/StatusBadge';
import ClaimDocumentDialog from '@/components/owner/ClaimDocumentDialog';
import MyClaims from '@/components/owner/MyClaims';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { documentTypeLabel, formatDate, formatDateTime, maskDocumentNumber } from '@/lib/ldrs';

async function loadOwnerDashboard(userId) {
  const [reports, matches, alerts, counts, points, codes, claims] = await Promise.all([
    base44.entities.LossReport.filter({ owner_user_id: userId }, { sort: '-created_date', limit: 10 }),
    base44.entities.Match.filter({ owner_user_id: userId }, { sort: '-created_date', limit: 10 }),
    base44.entities.Notification.filter({ user_id: userId }, { sort: '-created_date', limit: 3 }),
    Promise.all([
      base44.entities.LossReport.count({ owner_user_id: userId }),
      base44.entities.Match.count({ owner_user_id: userId, match_status: { $in: ['Confirmed', 'Returned'] } }),
      base44.entities.Notification.count({ user_id: userId }),
    ]),
    base44.entities.PickupPoint.filter({ active: true }, { sort: 'name', limit: 100 }),
    base44.entities.OtpCode.filter({ owner_user_id: userId, used: false }, { sort: '-created_date', limit: 50 }),
    base44.entities.Claim.filter({ owner_user_id: userId }, { sort: '-created_date', limit: 10 }),
  ]);

  const documentIds = matches.map(function (match) {
    return match.document_id;
  });
  const documentsById = {};
  if (documentIds.length) {
    (await base44.entities.Document.filter({ id: { $in: documentIds } })).forEach(function (doc) {
      documentsById[doc.id] = doc;
    });
  }
  return { reports, matches, alerts, points, codes, claims, documentsById, counts };
}

function CollectionCard({ match, document, pointName, code }) {
  return (
    <div className="rounded-lg border border-success-border bg-success-subtle p-4 text-success-subtle-foreground">
      <p className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        {document ? documentTypeLabel(document.document_type) : 'Your document'} is ready for collection
      </p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide opacity-80">Reference code</dt>
          <dd className="mt-0.5 font-mono font-semibold">{match.reference_code || 'Sent to you by alert'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide opacity-80">Collect from</dt>
          <dd className="mt-0.5 font-semibold">{pointName}</dd>
        </div>
      </dl>
      {match.match_status === 'Confirmed' ? (
        code ? (
          <div className="mt-3 rounded-md border border-success-border bg-card p-3 text-foreground">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Collection code
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em]">{code.otp_code}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Show this code to the officer at the counter only. It expires {formatDateTime(code.expires_at)}.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm">No collection code yet. The officer creates one when you arrive, and it appears here.</p>
        )
      ) : null}
      <Link to="/alerts" className="mt-3 inline-block text-sm font-medium underline">
        View collection details
      </Link>
    </div>
  );
}

export default function OwnerDashboard({ user }) {
  const [claimOpen, setClaimOpen] = useState(false);
  const { data, loading, error, reload } = useResource(
    function () {
      return loadOwnerDashboard(user.id);
    },
    [user.id],
  );

  const header = (
    <PageHeader
      title={'Welcome, ' + (user.full_name || 'LDRS user')}
      description="Report a lost document, search what has been handed in, or claim a document you recognise."
      actions={
        <>
          <Button asChild>
            <Link to="/report-lost">
              <FileWarning aria-hidden="true" />
              Report a lost document
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/search">
              <FileSearch aria-hidden="true" />
              Search
            </Link>
          </Button>
          <Button
            variant="secondary"
            onClick={function () {
              setClaimOpen(true);
            }}
          >
            <ClipboardCheck aria-hidden="true" />
            Claim a document
          </Button>
        </>
      }
    />
  );

  if (loading && !data) return <>{header}<Loader label="Loading your dashboard" /></>;
  if (error) return <>{header}<ErrorState title="Your dashboard could not be loaded" error={error} onRetry={reload} /></>;

  const { reports, matches, alerts, points, codes, claims, documentsById, counts } = data;
  const pointName = function (id) {
    const point = points.find(function (item) {
      return item.id === id;
    });
    return point ? point.name : 'Shown in your alerts';
  };
  const ready = matches.filter(function (match) {
    return match.match_status === 'Confirmed';
  });
  const activeCode = {};
  codes.forEach(function (item) {
    if (!activeCode[item.match_id] && new Date(item.expires_at).getTime() > Date.now()) activeCode[item.match_id] = item;
  });

  return (
    <div>
      {header}
      <div className="space-y-section">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="My lost reports" value={counts[0]} icon={FileSearch} tone="primary" />
          <StatCard label="Confirmed matches" value={counts[1]} icon={ShieldCheck} tone="success" />
          <StatCard label="Alerts received" value={counts[2]} icon={BellRing} tone="accent" />
        </div>

        {ready.length ? (
          <section aria-labelledby="ready-heading" className="space-y-3">
            <h2 id="ready-heading">Ready for collection</h2>
            {ready.map(function (match) {
              const document = documentsById[match.document_id];
              return (
                <CollectionCard
                  key={match.id}
                  match={match}
                  document={document}
                  pointName={document ? pointName(document.pickup_point_id) : 'Shown in your alerts'}
                  code={activeCode[match.id]}
                />
              );
            })}
          </section>
        ) : null}

        {claims.length ? (
          <section aria-labelledby="claims-heading" className="space-y-3">
            <h2 id="claims-heading">My claims</h2>
            <MyClaims claims={claims} />
          </section>
        ) : null}

        <div className="grid gap-section lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>My lost reports</CardTitle>
              <Button variant="link" size="sm" asChild>
                <Link to="/alerts">See all</Link>
              </Button>
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
                  icon={FileSearch}
                  title="No lost reports yet"
                  description="Report a document you have lost and we will match it when it is handed in."
                  className="border-0 py-6"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Latest alerts</CardTitle>
              <Button variant="link" size="sm" asChild>
                <Link to="/alerts">See all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {alerts.length ? (
                <ul className="divide-y divide-border">
                  {alerts.map(function (alert) {
                    return (
                      <li key={alert.id} className="py-3 first:pt-0 last:pb-0">
                        <p className="text-sm">{alert.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(alert.created_date)}</p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState icon={BellRing} title="No alerts yet" description="Alerts about your documents appear here." className="border-0 py-6" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ClaimDocumentDialog open={claimOpen} onOpenChange={setClaimOpen} user={user} onClaimed={reload} />
    </div>
  );
}

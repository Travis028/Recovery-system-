import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import Loader from '@/components/Loader';
import StatusBadge from '@/components/StatusBadge';
import ClaimDocumentDialog from '@/components/owner/ClaimDocumentDialog';
import MyClaims from '@/components/owner/MyClaims';
import { documentTypeLabel, formatDate, formatDateTime, maskDocumentNumber } from '@/lib/ldrs';
import { BellRing, ClipboardCheck, FilePlus, FileSearch, ShieldCheck, Sparkles } from 'lucide-react';

export default function OwnerDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [matches, setMatches] = useState([]);
  const [documentsById, setDocumentsById] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [codes, setCodes] = useState([]);
  const [points, setPoints] = useState([]);
  const [claims, setClaims] = useState([]);
  const [claimOpen, setClaimOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [stats, setStats] = useState({ reports: 0, matches: 0, alerts: 0 });

  useEffect(
    function () {
      let active = true;
      const load = async function () {
        const reportPage = await base44.entities.LossReport.filter(
          { owner_user_id: user.id },
          { sort: '-created_date', limit: 10 },
        );
        const matchList = await base44.entities.Match.filter({ owner_user_id: user.id }, { sort: '-created_date', limit: 10 });
        const alertPage = await base44.entities.Notification.filter(
          { user_id: user.id },
          { sort: '-created_date', limit: 3 },
        );
        const counts = await Promise.all([
          base44.entities.LossReport.count({ owner_user_id: user.id }),
          base44.entities.Match.count({ owner_user_id: user.id, match_status: { $in: ['Confirmed', 'Returned'] } }),
          base44.entities.Notification.count({ user_id: user.id }),
        ]);
        const pointPage = await base44.entities.PickupPoint.filter({ active: true }, { sort: 'name', limit: 100 });
        const otpPage = await base44.entities.OtpCode.filter(
          { owner_user_id: user.id, used: false },
          { sort: '-created_date', limit: 50 },
        );
        const claimPage = await base44.entities.Claim.filter(
          { owner_user_id: user.id },
          { sort: '-created_date', limit: 10 },
        );
        if (!active) return;
        const matchItems = matchList.items || matchList || [];
        const documentIds = matchItems
          .map(function (match) {
            return match.document_id;
          })
          .filter(Boolean);
        const documentMap = {};
        if (documentIds.length) {
          const documentList = await base44.entities.Document.filter({ id: { $in: documentIds } });
          (documentList.items || documentList || []).forEach(function (doc) {
            documentMap[doc.id] = doc;
          });
        }
        setReports(reportPage.items || []);
        setMatches(matchItems);
        setDocumentsById(documentMap);
        setAlerts(alertPage.items || []);
        setPoints(pointPage.items || []);
        setCodes(otpPage.items || []);
        setClaims(claimPage.items || []);
        setStats({ reports: counts[0], matches: counts[1], alerts: counts[2] });
        setLoading(false);
      };
      load();
      return function () {
        active = false;
      };
    },
    [user.id, reloadKey],
  );

  if (loading) return <Loader label="Loading your dashboard" />;

  const pointName = function (id) {
    const point = points.find(function (item) {
      return item.id === id;
    });
    return point ? point.name : 'Shown on your alerts';
  };

  const confirmed = matches.filter(function (match) {
    return match.match_status === 'Confirmed' || match.match_status === 'Returned';
  });

  const codeForMatch = {};
  codes.forEach(function (item) {
    if (!codeForMatch[item.match_id] && new Date(item.expires_at).getTime() > Date.now()) {
      codeForMatch[item.match_id] = item;
    }
  });

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-violet-800 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Owner dashboard</p>
        <h1 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">Welcome, {user.full_name || 'LDRS user'}</h1>
        <p className="mt-2 max-w-xl text-sm text-blue-100">
          Report a lost document or search the documents that have been handed in.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button className="gap-2 rounded-xl bg-white text-blue-900 hover:bg-blue-50" asChild>
            <Link to="/report-lost">
              <FilePlus className="h-4 w-4" />
              Report a lost document
            </Link>
          </Button>
          <Button
            variant="outline"
            className="gap-2 rounded-xl border-white/40 bg-transparent text-white hover:bg-white/10"
            asChild
          >
            <Link to="/search">
              <FileSearch className="h-4 w-4" />
              Search found documents
            </Link>
          </Button>
          <Button
            variant="outline"
            className="gap-2 rounded-xl border-white/40 bg-transparent text-white hover:bg-white/10"
            onClick={function () {
              setClaimOpen(true);
            }}
          >
            <ClipboardCheck className="h-4 w-4" />
            Claim a document
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="My lost reports" value={stats.reports} icon={FileSearch} tone="blue" />
        <StatCard label="Confirmed matches" value={stats.matches} icon={ShieldCheck} tone="emerald" />
        <StatCard label="Alerts received" value={stats.alerts} icon={BellRing} tone="violet" />
      </div>

      {confirmed.length ? (
        <div className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-slate-900">Your document is ready for collection</h2>
          {confirmed.map(function (match) {
            const document = documentsById[match.document_id];
            return (
              <div key={match.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 font-heading text-sm font-semibold text-emerald-900">
                  <Sparkles className="h-4 w-4" />
                  A confirmed match is waiting for you
                </p>
                <p className="mt-2 text-sm text-emerald-900">
                  Reference code: <span className="font-semibold">{match.reference_code || 'Sent to you by alert'}</span>
                </p>
                <p className="mt-1 text-sm text-emerald-900">
                  Collect from:{' '}
                  <span className="font-semibold">{document ? pointName(document.pickup_point_id) : 'Shown on your alerts'}</span>
                </p>
                {match.match_status === 'Confirmed' ? (
                  codeForMatch[match.id] ? (
                    <p className="mt-2 rounded-xl bg-white/70 p-3 text-sm text-emerald-900">
                      Collection code:{' '}
                      <span className="font-heading text-lg font-bold tracking-[0.2em]">
                        {codeForMatch[match.id].otp_code}
                      </span>
                      <span className="block text-xs text-emerald-800">
                        Show this code to the officer at the pickup point. It expires{' '}
                        {formatDateTime(codeForMatch[match.id].expires_at)}.
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-emerald-800">
                      No active collection code yet. The officer generates one when you arrive — it will appear here.
                    </p>
                  )
                ) : null}
                <Link to="/alerts" className="mt-2 inline-block text-xs font-semibold text-emerald-900 underline">
                  View full collection details
                </Link>
              </div>
            );
          })}
        </div>
      ) : null}

      {claims.length ? (
        <div>
          <h2 className="mb-3 font-heading text-lg font-semibold text-slate-900">My claims</h2>
          <MyClaims claims={claims} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-heading text-lg font-semibold text-slate-900">My lost reports</h2>
          {reports.length ? (
            <div className="space-y-3">
              {reports.map(function (report) {
                return (
                  <div
                    key={report.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-heading text-sm font-semibold text-slate-900">
                        {documentTypeLabel(report.document_type)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {maskDocumentNumber(report.document_number)} | Lost on {formatDate(report.date_lost)}
                      </p>
                    </div>
                    <StatusBadge status={report.status} kind="loss" />
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={FileSearch}
              title="No lost reports yet"
              description="Report a document you have lost so we can match it when it is handed in."
              action={
                <Button className="rounded-xl bg-blue-900 hover:bg-blue-950" asChild>
                  <Link to="/report-lost">Report a lost document</Link>
                </Button>
              }
            />
          )}
        </div>

        <div>
          <h2 className="mb-3 font-heading text-lg font-semibold text-slate-900">Latest alerts</h2>
          {alerts.length ? (
            <div className="space-y-3">
              {alerts.map(function (alert) {
                return (
                  <div key={alert.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-700">{alert.message}</p>
                    <p className="mt-2 text-xs text-slate-400">{formatDate(alert.created_date)}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No alerts yet" description="Alerts about your documents will appear here." icon={BellRing} />
          )}
        </div>
      </div>

      <ClaimDocumentDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        user={user}
        onClaimed={function () {
          setReloadKey(function (key) {
            return key + 1;
          });
        }}
      />
    </div>
  );
}

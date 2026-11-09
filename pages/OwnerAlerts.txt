import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import Loader from '@/components/Loader';
import StatusBadge from '@/components/StatusBadge';
import useLdrsUser from '@/hooks/useLdrsUser';
import { DELIVERY_STATUS_LABELS, documentTypeLabel, formatDate, formatDateTime, maskDocumentNumber } from '@/lib/ldrs';
import { BellRing, Building2, ShieldCheck } from 'lucide-react';

function AlertsContent() {
  const { user } = useLdrsUser();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [matches, setMatches] = useState([]);
  const [documentsById, setDocumentsById] = useState({});
  const [points, setPoints] = useState([]);
  const [reports, setReports] = useState([]);

  useEffect(
    function () {
      let active = true;
      const load = async function () {
        const alertPage = await base44.entities.Notification.filter(
          { user_id: user.id },
          { sort: '-created_date', limit: 50 },
        );
        const matchList = await base44.entities.Match.filter(
          { owner_user_id: user.id, match_status: { $in: ['Confirmed', 'Returned'] } },
          { sort: '-created_date', limit: 50 },
        );
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
        const reportPage = await base44.entities.LossReport.filter(
          { owner_user_id: user.id },
          { sort: '-created_date', limit: 50 },
        );
        const pointList = await base44.entities.PickupPoint.filter({ active: true }, { sort: 'name', limit: 100 });

        if (!active) return;
        setAlerts(alertPage.items || []);
        setMatches(matchItems);
        setDocumentsById(documentMap);
        setReports(reportPage.items || []);
        setPoints(pointList.items || []);
        setLoading(false);
      };
      load();
      return function () {
        active = false;
      };
    },
    [user.id],
  );

  if (loading) return <Loader label="Loading your alerts" />;

  const pointName = function (id) {
    const point = points.find(function (item) {
      return item.id === id;
    });
    return point ? point.name + (point.location ? ', ' + point.location : '') : 'Shown in your alert message';
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold text-slate-900">Alerts sent to you</h2>
        {alerts.length ? (
          <div className="space-y-3">
            {alerts.map(function (alert) {
              return (
                <div key={alert.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm text-slate-800">{alert.message}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatDateTime(alert.created_date)}
                    {' | '}
                    {DELIVERY_STATUS_LABELS[alert.delivery_status] || alert.delivery_status}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={BellRing}
            title="No alerts yet"
            description="When a document matching your report is handed in, the alert will appear here."
          />
        )}
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold text-slate-900">Confirmed matches ready for collection</h2>
        {matches.length ? (
          <div className="space-y-3">
            {matches.map(function (match) {
              const doc = documentsById[match.document_id];
              return (
                <div key={match.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="flex items-center gap-2 font-heading text-sm font-semibold text-emerald-900">
                    <ShieldCheck className="h-4 w-4" />
                    {doc ? documentTypeLabel(doc.document_type) : 'Document'} - {match.match_status}
                  </p>
                  <p className="mt-2 text-sm text-emerald-900">
                    Reference code: <span className="font-semibold">{match.reference_code || 'Included in your alert'}</span>
                  </p>
                  <p className="mt-1 flex items-start gap-2 text-sm text-emerald-900">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
                    Collect from {doc ? pointName(doc.pickup_point_id) : 'the pickup point in your alert'}
                  </p>
                  <p className="mt-2 text-xs text-emerald-800">
                    Bring the document number with you. When you arrive, the officer generates a one-time collection code
                    that appears on your dashboard — show it to the officer to release the document.
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="No confirmed match yet"
            description="A confirmed match will show the pickup point and your reference code here."
          />
        )}
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold text-slate-900">Status of my lost reports</h2>
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
            icon={BellRing}
            title="No lost reports yet"
            description="Report your lost document to start receiving alerts."
            action={
              <Link to="/report-lost" className="text-sm font-semibold text-blue-900 underline">
                Report a lost document
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}

export default function OwnerAlerts() {
  return (
    <RoleGuard allow={['Owner']}>
      <PageHeader
        title="Alerts"
        description="System alerts about your documents, the pickup point to collect from and the status of each report."
      />
      <AlertsContent />
    </RoleGuard>
  );
}

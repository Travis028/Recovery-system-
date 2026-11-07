import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import Loader from '@/components/Loader';
import MatchCard from '@/components/matches/MatchCard';
import ClaimCard from '@/components/claims/ClaimCard';
import useLdrsUser from '@/hooks/useLdrsUser';
import { useToast } from '@/components/ui/use-toast';
import { ClipboardCheck, ShieldCheck } from 'lucide-react';
import ErrorState from '@/components/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function MatchReviewContent() {
  const { user, role } = useLdrsUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [confirmed, setConfirmed] = useState([]);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [claimDocsById, setClaimDocsById] = useState({});
  const [documentsById, setDocumentsById] = useState({});
  const [reportsById, setReportsById] = useState({});
  const [pointsById, setPointsById] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = async function () {
    setLoading(true);
    setError(null);
    try {
      const stationScoped = role === 'Officer' && user.pickup_point_id;
      let documentIds = null;

      if (stationScoped) {
        const stationDocuments = await api.entities.Document.filter({ pickup_point_id: user.pickup_point_id });
        documentIds = stationDocuments.map(function (doc) {
          return doc.id;
        });
        if (!documentIds.length) {
          setPending([]);
          setConfirmed([]);
          setPendingClaims([]);
          setLoading(false);
          return;
        }
      }

      const scope = documentIds ? { document_id: { $in: documentIds } } : {};
      const results = await Promise.all([
        api.entities.Match.filter({ ...scope, match_status: 'Pending' }, { sort: '-created_date', limit: 50 }),
        api.entities.Match.filter({ ...scope, match_status: 'Confirmed' }, { sort: '-created_date', limit: 50 }),
      ]);
      const pendingItems = results[0];
      const confirmedItems = results[1];
      const all = pendingItems.concat(confirmedItems);

      const docIds = [...new Set(all.map((match) => match.document_id).filter(Boolean))];
      const reportIds = [...new Set(all.map((match) => match.loss_report_id).filter(Boolean))];

      const docMap = {};
      if (docIds.length) {
        const docList = await api.entities.Document.filter({ id: { $in: docIds } });
        docList.forEach(function (doc) {
          docMap[doc.id] = doc;
        });
      }

      const reportMap = {};
      if (reportIds.length) {
        const reportList = await api.entities.LossReport.filter({ id: { $in: reportIds } });
        reportList.forEach(function (report) {
          reportMap[report.id] = report;
        });
      }

      const pointMap = {};
      const pointList = await api.entities.PickupPoint.list();
      pointList.forEach(function (point) {
        pointMap[point.id] = point;
      });

      const claimPage = await api.entities.Claim.filter({ status: 'Pending' }, { sort: '-created_date', limit: 50 });
      const claimItems = claimPage.filter(function (claim) {
        return !documentIds || documentIds.indexOf(claim.document_id) >= 0;
      });
      const claimDocs = {};
      await Promise.all(
        claimItems.map(async function (claim) {
          if (!claim.document_id) return;
          try {
            claimDocs[claim.document_id] = await api.entities.Document.get(claim.document_id);
          } catch (docError) {
            console.error('Claimed document could not be loaded', docError);
          }
        }),
      );

      setPending(pendingItems);
      setConfirmed(confirmedItems);
      setPendingClaims(claimItems);
      setClaimDocsById(claimDocs);
      setDocumentsById(docMap);
      setReportsById(reportMap);
      setPointsById(pointMap);
    } catch (loadError) {
      console.error('Matches could not be loaded', loadError);
      setError(loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(
    function () {
      load();
    },
    // load reads role and station from the user; re-run only when those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, user.id, user.pickup_point_id],
  );

  const handleConfirm = async function (match) {
    setBusyId(match.id);
    try {
      await api.functions.invoke('confirmMatch', { match_id: match.id });
      await load();
      toast({ tone: 'success', title: 'Match confirmed', description: 'The owner has been alerted with the pickup point and reference code.' });
    } catch (confirmError) {
      toast({ tone: 'danger', title: 'Could not confirm the match', description: confirmError.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async function (match) {
    setBusyId(match.id);
    try {
      await api.functions.invoke('rejectMatch', { match_id: match.id });
      await load();
      toast({ tone: 'success', title: 'Match rejected', description: 'The document stays available for other reports.' });
    } catch (rejectError) {
      toast({ tone: 'danger', title: 'Could not reject the match', description: rejectError.message });
    } finally {
      setBusyId(null);
    }
  };

  const decideClaim = async function (claim, decision) {
    setBusyId('claim-' + claim.id);
    try {
      await api.functions.invoke(decision === 'approve' ? 'approveClaim' : 'rejectClaim', { claim_id: claim.id });
      await load();
      toast(
        decision === 'approve'
          ? { tone: 'success', title: 'Claim approved', description: 'The owner received the pickup point and reference code.' }
          : { tone: 'success', title: 'Claim rejected', description: 'The owner was told to bring proof of ownership.' },
      );
    } catch (claimError) {
      toast({ tone: 'danger', title: decision === 'approve' ? 'Could not approve the claim' : 'Could not reject the claim', description: claimError.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleNotify = async function (match) {
    setBusyId(match.id);
    try {
      await api.functions.invoke('sendCollectionReminder', { match_id: match.id });
      toast({ tone: 'success', title: 'Reminder sent', description: 'The owner received the pickup point and reference code again.' });
    } catch (notifyError) {
      toast({ tone: 'danger', title: 'Could not send the reminder', description: notifyError.message });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Loader label="Loading matches" />;
  if (error) return <ErrorState title="Matches could not be loaded" error={error} onRetry={load} />;

  const pointNameFor = function (match) {
    const doc = documentsById[match.document_id];
    return doc && pointsById[doc.pickup_point_id] ? pointsById[doc.pickup_point_id].name : '';
  };

  const renderMatches = function (list) {
    return list.map(function (match) {
      return (
        <MatchCard
          key={match.id}
          match={match}
          document={documentsById[match.document_id]}
          report={reportsById[match.loss_report_id]}
          pickupPointName={pointNameFor(match)}
          canReview
          busy={busyId === match.id}
          onConfirm={handleConfirm}
          onReject={handleReject}
          onNotify={handleNotify}
        />
      );
    });
  };

  const defaultTab = pendingClaims.length ? 'claims' : pending.length ? 'pending' : 'confirmed';

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList aria-label="Review queues">
        <TabsTrigger value="claims">
          Ownership claims <Badge tone={pendingClaims.length ? 'warning' : 'neutral'}>{pendingClaims.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="pending">
          Possible matches <Badge tone={pending.length ? 'warning' : 'neutral'}>{pending.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="confirmed">
          Confirmed <Badge tone="neutral">{confirmed.length}</Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="claims" className="space-y-3">
        {pendingClaims.length ? (
          pendingClaims.map(function (claim) {
            return (
              <ClaimCard
                key={claim.id}
                claim={claim}
                document={claimDocsById[claim.document_id]}
                busy={busyId === 'claim-' + claim.id}
                onApprove={function (claim) { decideClaim(claim, 'approve'); }}
                onReject={function (claim) { decideClaim(claim, 'reject'); }}
              />
            );
          })
        ) : (
          <EmptyState icon={ClipboardCheck} title="No claims waiting" description="Claims that owners send from the search screen appear here for checking." />
        )}
      </TabsContent>

      <TabsContent value="pending" className="space-y-3">
        {pending.length ? (
          renderMatches(pending)
        ) : (
          <EmptyState icon={ClipboardCheck} title="No possible matches" description="Matches found by name, which need an officer's decision, appear here." />
        )}
      </TabsContent>

      <TabsContent value="confirmed" className="space-y-3">
        {confirmed.length ? (
          renderMatches(confirmed)
        ) : (
          <EmptyState icon={ShieldCheck} title="No confirmed matches" description="Confirmed matches are ready for the owner to collect." />
        )}
      </TabsContent>
    </Tabs>
  );
}

export default function MatchReview() {
  return (
    <>
      <PageHeader
        title="Match review"
        description="Check ownership claims and possible matches. Matches on the exact number are confirmed automatically."
      />
      <MatchReviewContent />
    </>
  );
}

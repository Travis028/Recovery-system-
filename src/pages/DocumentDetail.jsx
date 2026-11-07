import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Archive, KeyRound, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import Loader from '@/components/Loader';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import PrivateImage from '@/components/PrivateImage';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { documentTypeLabel, formatDate, formatDateTime, idLabelFor } from '@/lib/ldrs';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit';
import { useToast } from '@/components/ui/use-toast';

function Item({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function DocumentDetailContent() {
  const { documentId } = useParams();
  const { user, role } = useLdrsUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState(null);
  const [point, setPoint] = useState(null);
  const [matches, setMatches] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async function () {
    try {
      const record = await base44.entities.Document.get(documentId);
      setDoc(record);
      setPoint(await base44.entities.PickupPoint.get(record.pickup_point_id).catch(function () { return null; }));
      setMatches(role === 'Finder' ? [] : await base44.entities.Match.filter({ document_id: documentId }, { sort: '-created_date' }));
    } catch {
      setDoc(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(function () {
    load().then(function () {
      logAction({ action: AUDIT_ACTIONS.RECORD_OPENED, details: 'Document record ' + documentId.slice(0, 8) + ' opened', user });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  if (loading) return <Loader label="Opening the record" />;
  if (!doc) {
    return (
      <EmptyState
        title="Record not found"
        description="It may be held at another station, or your account may not have access to it."
        action={
          <Button variant="secondary" asChild>
            <Link to="/documents">Back to documents</Link>
          </Button>
        }
      />
    );
  }

  const canChange = (role === 'Officer' && user.approved) || role === 'Admin';
  const setStatus = async function (status) {
    setBusy(true);
    try {
      await base44.entities.Document.update(doc.id, { status });
      await logAction({ action: AUDIT_ACTIONS.DOCUMENT_STATUS_CHANGE, details: 'Document ' + doc.id.slice(0, 8) + ' set to ' + status, user });
      toast({ tone: 'success', title: 'Status updated', description: 'The document is now marked ' + status + '.' });
      await load();
    } catch (error) {
      toast({ tone: 'danger', title: 'Could not change the status', description: error.message });
    } finally {
      setBusy(false);
    }
  };
  const confirmed = matches.find(function (m) {
    return m.match_status === 'Confirmed';
  });
  const showActions = canChange && (confirmed || doc.status !== 'Returned');

  return (
    <div className="space-y-section">
      {doc.duplicate_flag ? (
        <Alert tone="warning" title="Flagged as a possible duplicate">
          <ul className="list-disc space-y-1 pl-5">
            {(doc.duplicate_reasons || []).map(function (reason) {
              return <li key={reason}>{reason}</li>;
            })}
          </ul>
          {doc.duplicate_of_id ? (
            <p className="mt-2">
              <Link to={'/documents/' + doc.duplicate_of_id}>Open the earlier record</Link>
            </p>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid gap-section lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{documentTypeLabel(doc.document_type)}</CardTitle>
            <StatusBadge status={doc.status} />
          </CardHeader>
          <CardContent>
            <dl className="grid gap-5 sm:grid-cols-2">
              <Item label="Name on the document">{doc.owner_name}</Item>
              <Item label={idLabelFor(doc.document_type)}>
                <span className="font-mono">{doc.document_number}</span>
              </Item>
              <Item label="Where found">{doc.found_location}</Item>
              <Item label="Date found">{formatDate(doc.date_found)}</Item>
              <Item label="Held at">{point ? point.name : '—'}</Item>
              <Item label="Registered">{formatDateTime(doc.created_date)}</Item>
              {doc.ocr_used ? (
                <Item label="OCR confidence">
                  Name {doc.ocr_name_confidence}% · number {doc.ocr_number_confidence}%
                </Item>
              ) : null}
              {doc.returned_at ? <Item label="Returned">{formatDateTime(doc.returned_at)}</Item> : null}
            </dl>
            <p className="mt-6 text-xs text-muted-foreground">Keep these details confidential. Opening this record is recorded in the audit trail.</p>
          </CardContent>
          {showActions ? (
            <CardFooter>
              {confirmed ? (
                <Button asChild>
                  <Link to={'/handover/' + confirmed.id}>
                    <KeyRound aria-hidden="true" />
                    Start handover
                  </Link>
                </Button>
              ) : null}
              {doc.status !== 'Returned' && doc.status !== 'Unclaimed' ? (
                <Button variant="secondary" disabled={busy} onClick={function () { setStatus('Unclaimed'); }}>
                  <Archive aria-hidden="true" />
                  Mark unclaimed
                </Button>
              ) : null}
              {doc.status === 'Unclaimed' ? (
                <Button variant="secondary" disabled={busy} onClick={function () { setStatus('Found'); }}>
                  <RotateCcw aria-hidden="true" />
                  Return to held documents
                </Button>
              ) : null}
            </CardFooter>
          ) : null}
        </Card>

        <div className="space-y-section">
          <Card className="overflow-hidden">
            <PrivateImage fileUri={doc.image_url} alt={'Photograph of the ' + documentTypeLabel(doc.document_type)} className="h-72 w-full bg-muted" />
          </Card>
          {matches.length ? (
            <Card>
              <CardHeader>
                <CardTitle as="h3">Matches</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {matches.map(function (match) {
                  return (
                    <div key={match.id} className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                      <span>
                        {match.match_type} · score {match.match_score}
                        {match.reference_code ? <span className="font-mono"> · {match.reference_code}</span> : null}
                      </span>
                      <StatusBadge status={match.match_status} kind="match" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function DocumentDetail() {
  return (
    <RoleGuard allow={['Finder', 'Officer', 'Admin']}>
      <PageHeader
        title="Document record"
        description="Full details are shown only here, never in lists."
        breadcrumbs={[{ label: 'Documents', to: '/documents' }, { label: 'Record' }]}
      />
      <DocumentDetailContent />
    </RoleGuard>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import RoleGuard from '@/components/RoleGuard';
import PageHeader from '@/components/PageHeader';
import Loader from '@/components/Loader';
import StatusBadge from '@/components/StatusBadge';
import PrivateImage from '@/components/PrivateImage';
import { Button } from '@/components/ui/button';
import { documentTypeLabel, formatDate, formatDateTime, idLabelFor } from '@/lib/ldrs';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, Archive, ArrowLeft, KeyRound } from 'lucide-react';

function Item({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{children}</dd>
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
    } catch (error) {
      setDoc(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(function () {
    load().then(function () {
      logAction({ action: AUDIT_ACTIONS.RECORD_OPENED, details: 'Document record ' + documentId.slice(0, 8) + ' opened', user });
    });
  }, [documentId]);

  if (loading) return <Loader label="Opening the record" />;
  if (!doc) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="font-heading text-lg font-semibold text-slate-800">Record not found</p>
        <p className="mt-1 text-sm text-slate-500">It may be held at another station, or you may not have access to it.</p>
        <Button variant="outline" className="mt-4 rounded-xl" asChild><Link to="/documents">Back to documents</Link></Button>
      </div>
    );
  }

  const canChange = (role === 'Officer' && user.approved) || role === 'Admin';
  const setStatus = async function (status) {
    setBusy(true);
    try {
      await base44.entities.Document.update(doc.id, { status });
      await logAction({ action: AUDIT_ACTIONS.DOCUMENT_STATUS_CHANGE, details: 'Document ' + doc.id.slice(0, 8) + ' set to ' + status, user });
      toast({ title: 'Status updated', description: 'The document is now marked ' + status + '.' });
      await load();
    } catch (error) {
      toast({ title: 'Could not change the status', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };
  const confirmed = matches.find(function (m) { return m.match_status === 'Confirmed'; });

  return (
    <div className="space-y-6">
      <Button variant="outline" className="gap-2 rounded-xl" asChild>
        <Link to="/documents"><ArrowLeft className="h-4 w-4" />Back to documents</Link>
      </Button>

      {doc.duplicate_flag ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="flex items-center gap-2 font-heading text-sm font-semibold"><AlertTriangle className="h-4 w-4" /> Why this document was flagged</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {(doc.duplicate_reasons || []).map(function (reason) { return <li key={reason}>{reason}</li>; })}
          </ul>
          {doc.duplicate_of_id ? (
            <Link to={'/documents/' + doc.duplicate_of_id} className="mt-2 inline-block text-xs font-semibold underline">Open the earlier record</Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold text-slate-900">{documentTypeLabel(doc.document_type)}</h2>
            <StatusBadge status={doc.status} />
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Item label="Name on the document">{doc.owner_name}</Item>
            <Item label={idLabelFor(doc.document_type)}>{doc.document_number}</Item>
            <Item label="Where found">{doc.found_location}</Item>
            <Item label="Date found">{formatDate(doc.date_found)}</Item>
            <Item label="Held at">{point ? point.name : '—'}</Item>
            <Item label="Registered">{formatDateTime(doc.created_date)}</Item>
            {doc.ocr_used ? <Item label="OCR confidence">Name {doc.ocr_name_confidence}% · number {doc.ocr_number_confidence}%</Item> : null}
            {doc.returned_at ? <Item label="Returned">{formatDateTime(doc.returned_at)}</Item> : null}
          </dl>
          <p className="mt-5 text-xs text-slate-400">Keep these details confidential. Opening this record has been recorded in the audit trail.</p>
          {canChange ? (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {confirmed ? (
                <Button className="gap-2 rounded-xl bg-blue-900 hover:bg-blue-950" asChild>
                  <Link to={'/handover/' + confirmed.id}><KeyRound className="h-4 w-4" />Start handover</Link>
                </Button>
              ) : null}
              {doc.status !== 'Returned' && doc.status !== 'Unclaimed' ? (
                <Button variant="outline" className="gap-2 rounded-xl" disabled={busy} onClick={function () { setStatus('Unclaimed'); }}>
                  <Archive className="h-4 w-4" />Mark unclaimed
                </Button>
              ) : null}
              {doc.status === 'Unclaimed' ? (
                <Button variant="outline" className="rounded-xl" disabled={busy} onClick={function () { setStatus('Found'); }}>Return to held documents</Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="space-y-4">
          <PrivateImage fileUri={doc.image_url} className="h-72 w-full rounded-3xl border border-slate-200 bg-white" />
          {matches.length ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="font-heading text-sm font-semibold text-slate-900">Matches</p>
              <div className="mt-2 space-y-2">
                {matches.map(function (match) {
                  return (
                    <div key={match.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                      <span>{match.match_type} · score {match.match_score}{match.reference_code ? ' · ' + match.reference_code : ''}</span>
                      <StatusBadge status={match.match_status} kind="match" />
                    </div>
                  );
                })}
              </div>
            </div>
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

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import RoleGuard from '@/components/RoleGuard';
import Loader from '@/components/Loader';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { documentTypeLabel, formatDate, formatDateTime, idLabelFor, maskDocumentNumber } from '@/lib/ldrs';
import { ArrowLeft, Printer, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';

function HandoverReceiptContent() {
  const { handoverId } = useParams();
  const { user } = useLdrsUser();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [handover, setHandover] = useState(null);
  const [document, setDocument] = useState(null);
  const [match, setMatch] = useState(null);
  const [point, setPoint] = useState(null);
  const [officerName, setOfficerName] = useState('');
  const [qr, setQr] = useState('');

  useEffect(
    function () {
      let active = true;
      const load = async function () {
        setLoading(true);
        try {
          const record = await base44.entities.Handover.get(handoverId);
          const doc = await base44.entities.Document.get(record.document_id);
          const matched = await base44.entities.Match.get(record.match_id).catch(function () {
            return null;
          });
          let station = null;
          if (doc.pickup_point_id) {
            station = await base44.entities.PickupPoint.get(doc.pickup_point_id).catch(function () {
              return null;
            });
          }
          let officer = 'Authorised officer';
          if (record.officer_user_id === user.id) {
            officer = user.full_name || user.email || officer;
          } else {
            const officerRecord = await base44.entities.User.get(record.officer_user_id).catch(function () {
              return null;
            });
            if (officerRecord) officer = officerRecord.full_name || officerRecord.email || officer;
          }

          if (!active) return;
          setHandover(record);
          setDocument(doc);
          setMatch(matched);
          setPoint(station);
          setOfficerName(officer);
          const verifyUrl =
            window.location.origin + '/verify-receipt/' + record.id + '?h=' + String(record.integrity_hash || '').slice(0, 16);
          setQr(await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160, color: { dark: '#0b3b47', light: '#ffffff' } }));
        } catch (loadError) {
          console.error('Receipt could not be loaded', loadError);
          setMissing(true);
        } finally {
          if (active) setLoading(false);
        }
      };
      load();
      return function () {
        active = false;
      };
    },
    [handoverId, user.id, user.full_name, user.email],
  );

  if (loading) return <Loader label="Preparing the receipt" />;

  if (missing || !handover || !document) {
    return (
      <EmptyState
        title="Receipt not found"
        action={
          <Button variant="secondary" asChild>
            <Link to="/handover">Back to handover</Link>
          </Button>
        }
      />
    );
  }

  const fields = [
    ['Document type', documentTypeLabel(document.document_type)],
    ['Name on the document', document.owner_name],
    [idLabelFor(document.document_type), maskDocumentNumber(document.document_number)],
    ['Reference code', match ? match.reference_code : 'Not available'],
    ['Released to', handover.released_to],
    ['ID of the person collecting', handover.claimant_id_type ? handover.claimant_id_type + ' · ' + maskDocumentNumber(handover.claimant_id_number) : 'Not recorded'],
    ['Verification method', handover.verification_method],
    ['Released by', officerName],
    ['Pickup point', point ? point.name + ', ' + point.location : 'Not recorded'],
    ['Date found', formatDate(document.date_found)],
    ['Document status', document.status],
  ];

  return (
    <div className="space-y-section">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button onClick={function () { window.print(); }}>
          <Printer aria-hidden="true" />
          Print receipt
        </Button>
        <Button variant="secondary" asChild>
          <Link to="/handover">
            <ArrowLeft aria-hidden="true" />
            Back to handover
          </Link>
        </Button>
      </div>

      <article aria-label="Handover receipt" className="print-plain rounded-lg border border-border bg-card p-6 shadow-sm sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-semibold">LDRS</p>
              <p className="text-xs text-muted-foreground">Lost Documents Recovery System</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Handover receipt</p>
              <p className="mt-1 font-mono text-sm font-semibold">{handover.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(handover.released_at || handover.created_date)}</p>
            </div>
            {qr ? (
              <figure className="text-center">
                <img src={qr} alt="QR code that opens the receipt check page" className="h-24 w-24 rounded-md border border-border bg-white" />
                <figcaption className="mt-1 text-[11px] text-muted-foreground">Scan to verify</figcaption>
              </figure>
            ) : null}
          </div>
        </header>

        <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {fields.map(function (field) {
            return (
              <div key={field[0]}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field[0]}</dt>
                <dd className="mt-1 text-sm">{field[1]}</dd>
              </div>
            );
          })}
        </dl>

        {handover.notes ? (
          <div className="mt-6 rounded-md bg-muted p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Handover note</p>
            <p className="mt-1 text-sm">{handover.notes}</p>
          </div>
        ) : null}

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {['Signature of person collecting', 'Signature of officer'].map(function (label) {
            return (
              <div key={label}>
                <div className="h-10 border-b border-dashed border-border-strong" />
                <p className="mt-2 text-xs text-muted-foreground">{label}</p>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
          This receipt confirms the document above was released after the reference code, the document number, the claimant's ID and
          the one-time collection code were checked. The record cannot be changed. Scan the QR code to confirm the receipt is genuine.
          Integrity code: <span className="font-mono">{String(handover.integrity_hash || '').slice(0, 16)}</span>.
        </p>
      </article>
    </div>
  );
}

export default function HandoverReceipt() {
  return (
    <RoleGuard allow={['Officer', 'Admin']}>
      <PageHeader title="Handover receipt" breadcrumbs={[{ label: 'Handover', to: '/handover' }, { label: 'Receipt' }]} />
      <HandoverReceiptContent />
    </RoleGuard>
  );
}

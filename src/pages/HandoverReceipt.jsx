import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import RoleGuard from '@/components/RoleGuard';
import Loader from '@/components/Loader';
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
          setQr(await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160, color: { dark: '#0c4453' } }));
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
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="font-heading text-lg font-semibold text-slate-800">Receipt not found</p>
        <Button variant="outline" className="mt-4 rounded-xl" asChild>
          <Link to="/handover">Back to handover list</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 print:hidden">
        <Button variant="outline" className="gap-2 rounded-xl" asChild>
          <Link to="/handover">
            <ArrowLeft className="h-4 w-4" />
            Back to handover list
          </Link>
        </Button>
        <Button
          className="gap-2 rounded-xl bg-blue-900 hover:bg-blue-950"
          onClick={function () {
            window.print();
          }}
        >
          <Printer className="h-4 w-4" />
          Print receipt
        </Button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-900 to-violet-700 text-white">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="font-heading text-lg font-bold text-slate-900">LDRS</p>
              <p className="text-xs text-slate-500">Lost Documents Recovery System</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Handover receipt</p>
              <p className="mt-1 font-heading text-sm font-semibold text-slate-900">
                {handover.id.slice(0, 8).toUpperCase()}
              </p>
              <p className="text-xs text-slate-500">{formatDateTime(handover.released_at || handover.created_date)}</p>
            </div>
            {qr ? (
              <figure className="text-center">
                <img src={qr} alt="QR code to verify this receipt" className="h-24 w-24 rounded-lg border border-slate-200" />
                <figcaption className="mt-1 text-[10px] text-slate-500">Scan to verify</figcaption>
              </figure>
            ) : null}
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document type</dt>
            <dd className="mt-1 text-sm text-slate-800">{documentTypeLabel(document.document_type)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name on the document</dt>
            <dd className="mt-1 text-sm text-slate-800">{document.owner_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {idLabelFor(document.document_type)}
            </dt>
            <dd className="mt-1 text-sm text-slate-800">{maskDocumentNumber(document.document_number)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference code</dt>
            <dd className="mt-1 text-sm text-slate-800">{match ? match.reference_code : 'Not available'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Released to</dt>
            <dd className="mt-1 text-sm text-slate-800">{handover.released_to}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">ID of the person collecting</dt>
            <dd className="mt-1 text-sm text-slate-800">
              {handover.claimant_id_type
                ? handover.claimant_id_type + ' - ' + maskDocumentNumber(handover.claimant_id_number)
                : 'Not recorded'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification method</dt>
            <dd className="mt-1 text-sm text-slate-800">{handover.verification_method}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Released by</dt>
            <dd className="mt-1 text-sm text-slate-800">{officerName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pickup point</dt>
            <dd className="mt-1 text-sm text-slate-800">
              {point ? point.name + ' - ' + point.location : 'Not recorded'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date found</dt>
            <dd className="mt-1 text-sm text-slate-800">{formatDate(document.date_found)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document status</dt>
            <dd className="mt-1 text-sm text-slate-800">{document.status}</dd>
          </div>
        </dl>

        {handover.notes ? (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Handover note</p>
            <p className="mt-1 text-sm text-slate-700">{handover.notes}</p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <div className="h-10 border-b border-dashed border-slate-300" />
            <p className="mt-2 text-xs text-slate-500">Signature of person collecting</p>
          </div>
          <div>
            <div className="h-10 border-b border-dashed border-slate-300" />
            <p className="mt-2 text-xs text-slate-500">Signature of officer</p>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-500">
          This receipt confirms that the document described above was released after the reference code, document number,
          the claimant's physical ID and the one-time collection code were verified. The record is read-only. Scan the QR
          code to confirm the receipt is genuine. Integrity code: {String(handover.integrity_hash || '').slice(0, 16)}.
        </p>
      </div>
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

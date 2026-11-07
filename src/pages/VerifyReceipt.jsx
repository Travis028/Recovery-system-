import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Loader from '@/components/Loader';
import { formatDateTime } from '@/lib/ldrs';
import { ShieldCheck, ShieldX } from 'lucide-react';

/** Public page opened from the receipt's QR code. Shows no personal details. */
export default function VerifyReceipt() {
  const { handoverId } = useParams();
  const [params] = useSearchParams();
  const [result, setResult] = useState(null);

  useEffect(function () {
    base44.functions.invoke('verifyReceipt', { id: handoverId, h: params.get('h') || '' }).then(setResult).catch(function () { setResult({ valid: false }); });
  }, [handoverId]);

  if (!result) return <Loader label="Checking the receipt" />;
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className={'mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ' + (result.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
          {result.valid ? <ShieldCheck className="h-7 w-7" /> : <ShieldX className="h-7 w-7" />}
        </span>
        <h1 className="mt-4 font-heading text-xl font-bold text-slate-900">{result.valid ? 'Genuine LDRS handover receipt' : 'This receipt could not be verified'}</h1>
        {result.valid ? (
          <dl className="mt-5 space-y-2 text-left text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Receipt</dt><dd className="font-semibold">{result.receipt_number}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Document type</dt><dd>{result.document_type}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Released</dt><dd>{formatDateTime(result.released_at)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Pickup point</dt><dd>{result.pickup_point}</dd></div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-500">The receipt may be fake or altered. Contact the pickup point that issued it.</p>
        )}
        <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-blue-900 underline">Go to LDRS</Link>
      </div>
    </div>
  );
}

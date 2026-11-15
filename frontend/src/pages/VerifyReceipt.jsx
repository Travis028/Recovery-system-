import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { api } from '@/api/client';
import useResource from '@/hooks/useResource';
import Brand from '@/components/layout/Brand';
import Loader from '@/components/Loader';
import ThemeToggle from '@/theme/ThemeToggle';
import { formatDateTime } from '@/lib/ldrs';
import { cn } from '@/lib/utils';

/** Public page opened from the receipt's QR code. Shows no personal details. */
export default function VerifyReceipt() {
  const { handoverId } = useParams();
  const [params] = useSearchParams();
  const hash = params.get('h') || '';
  const { data: result, loading } = useResource(
    function () {
      return api.functions.invoke('verifyReceipt', { id: handoverId, h: hash }).catch(function () {
        return { valid: false };
      });
    },
    [handoverId, hash],
  );

  const rows = result && result.valid
    ? [
        ['Receipt', <span key="r" className="font-mono">{result.receipt_number}</span>],
        ['Document type', result.document_type],
        ['Released', formatDateTime(result.released_at)],
        ['Pickup point', result.pickup_point],
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-topbar max-w-3xl items-center justify-between px-page-x">
        <Brand to="/login" />
        <ThemeToggle />
      </header>
      <main className="flex justify-center px-page-x py-12">
        {loading || !result ? (
          <Loader label="Checking the receipt" />
        ) : (
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
            <span
              className={cn(
                'mx-auto flex h-12 w-12 items-center justify-center rounded-full',
                result.valid ? 'bg-success-subtle text-success-subtle-foreground' : 'bg-danger-subtle text-danger-subtle-foreground',
              )}
            >
              {result.valid ? <ShieldCheck className="h-6 w-6" aria-hidden="true" /> : <ShieldX className="h-6 w-6" aria-hidden="true" />}
            </span>
            <h1 className="mt-4 text-xl">{result.valid ? 'Genuine LDRS handover receipt' : 'This receipt could not be verified'}</h1>
            {result.valid ? (
              <dl className="mt-6 divide-y divide-border text-left text-sm">
                {rows.map(function (row) {
                  return (
                    <div key={row[0]} className="flex justify-between gap-4 py-2.5">
                      <dt className="text-muted-foreground">{row[0]}</dt>
                      <dd className="text-right font-medium">{row[1]}</dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">The receipt may be fake or altered. Contact the pickup point that issued it.</p>
            )}
            <Link to="/login" className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-2">
              Go to LDRS
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

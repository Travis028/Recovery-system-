import { Loader2 } from 'lucide-react';

export default function Loader({ label = 'Loading' }) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-muted-foreground" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

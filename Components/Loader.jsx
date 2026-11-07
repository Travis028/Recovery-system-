import { Loader2 } from 'lucide-react';

export default function Loader({ label }) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-slate-500" role="status">
      <Loader2 className="h-7 w-7 animate-spin text-blue-800" />
      <p className="text-sm">{label || 'Loading'}</p>
    </div>
  );
}

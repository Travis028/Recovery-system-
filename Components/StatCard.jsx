import { cn } from '@/lib/utils';

const TONES = {
  blue: 'bg-blue-50 text-blue-800',
  violet: 'bg-violet-50 text-violet-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
  slate: 'bg-slate-100 text-slate-700',
};

export default function StatCard({ label, value, icon: Icon, tone = 'blue', hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon ? (
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', TONES[tone] || TONES.blue)}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-heading text-2xl font-bold text-slate-900">{value === null || value === undefined ? '—' : value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

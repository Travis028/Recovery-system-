import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-3 font-heading text-base font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

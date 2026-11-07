export default function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

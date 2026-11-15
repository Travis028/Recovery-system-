import Breadcrumbs from '@/components/ui/breadcrumbs';

/** Title block at the top of every screen: optional breadcrumbs, one h1, description and actions. */
export default function PageHeader({ title, description, actions, breadcrumbs }) {
  return (
    <div className="mb-section print:hidden">
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

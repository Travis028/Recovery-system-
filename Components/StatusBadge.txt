import { cn } from '@/lib/utils';
import { CLAIM_STATUS_STYLES, DOC_STATUS_STYLES, MATCH_STATUS_STYLES, LOSS_STATUS_STYLES } from '@/lib/ldrs';

const STYLE_MAPS = {
  document: DOC_STATUS_STYLES,
  match: MATCH_STATUS_STYLES,
  loss: LOSS_STATUS_STYLES,
  claim: CLAIM_STATUS_STYLES,
};

export default function StatusBadge({ status, kind = 'document', className }) {
  const styles = STYLE_MAPS[kind] || DOC_STATUS_STYLES;
  const tone = styles[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide',
        tone,
        className,
      )}
    >
      {status || 'Unknown'}
    </span>
  );
}

import { Badge } from '@/components/ui/badge';

// Which status tone each record status uses. Kept here so every list shows the same colours.
const TONES = {
  document: { Found: 'info', Matched: 'accent', Notified: 'primary', Returned: 'success', Unclaimed: 'warning' },
  match: { Pending: 'warning', Confirmed: 'success', Rejected: 'danger', Returned: 'neutral' },
  loss: { Open: 'info', Matched: 'accent', Closed: 'success' },
  claim: { Pending: 'warning', Approved: 'success', Rejected: 'danger' },
  request: { Open: 'warning', Completed: 'success', Declined: 'neutral' },
};

export default function StatusBadge({ status, kind = 'document', className }) {
  const tone = (TONES[kind] || TONES.document)[status] || 'neutral';
  return (
    <Badge tone={tone} className={className}>
      {status || 'Unknown'}
    </Badge>
  );
}

import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';

/** Account problems that limit what the user can do, shown above every page. */
export default function AccountNotices({ user, role }) {
  const notices = [];
  if (role === 'Officer' && !user.approved) {
    notices.push(
      <Alert key="approval" tone="warning" title="Your officer account is waiting for approval">
        You can look around, but you cannot register, confirm or release documents until an administrator approves it.
      </Alert>,
    );
  }
  if (role === 'Owner' && !user.phone_verified) {
    notices.push(
      <Alert key="phone" tone="info" title="Verify your phone number">
        Searching and reporting a loss need a verified phone. <Link to="/my-data">Verify it now</Link>.
      </Alert>,
    );
  }
  if (!notices.length) return null;
  return <div className="mb-section space-y-3 print:hidden">{notices}</div>;
}

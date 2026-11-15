import PageHeader from '@/components/PageHeader';
import ReportLostForm from '@/components/owner/ReportLostForm';
import useLdrsUser from '@/hooks/useLdrsUser';

export default function ReportLost() {
  const { user } = useLdrsUser();
  return (
    <>
      <PageHeader
        title="Report a lost document"
        description="We compare your report with every document handed in and alert you as soon as there is a match."
      />
      {user ? <ReportLostForm user={user} /> : null}
    </>
  );
}

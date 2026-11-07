import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="font-heading text-xl font-bold text-slate-900">Page not found</h1>
      <Button className="mt-5 rounded-xl bg-blue-900 hover:bg-blue-950" asChild><Link to="/dashboard">Go to my dashboard</Link></Button>
    </div>
  );
}

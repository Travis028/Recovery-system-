import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import Loader from '@/components/Loader';
import DocumentRow from '@/components/documents/DocumentRow';
import { CheckCircle2, FilePlus, FolderOpen, HeartHandshake } from 'lucide-react';

export default function FinderDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState([]);
  const [points, setPoints] = useState([]);

  useEffect(function () {
    let active = true;
    Promise.all([
      base44.entities.Document.filter({ finder_user_id: user.id }, { sort: '-created_date', limit: 50 }),
      base44.entities.PickupPoint.list(),
    ]).then(function (results) {
      if (!active) return;
      setDocs(results[0]);
      setPoints(results[1]);
      setLoading(false);
    });
    return function () { active = false; };
  }, [user.id]);

  if (loading) return <Loader label="Loading your dashboard" />;
  const pointName = function (id) {
    const point = points.find(function (p) { return p.id === id; });
    return point ? point.name : '';
  };
  const returned = docs.filter(function (d) { return d.status === 'Returned'; }).length;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-violet-800 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Finder dashboard</p>
        <h1 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">Thank you, {user.full_name || 'finder'}</h1>
        <p className="mt-2 max-w-xl text-sm text-blue-100">
          Photograph the document you found, record where you found it and hand it in at a verified pickup point.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button className="gap-2 rounded-xl bg-white text-blue-900 hover:bg-blue-50" asChild>
            <Link to="/report-found"><FilePlus className="h-4 w-4" />Register a found document</Link>
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl border-white/40 bg-transparent text-white hover:bg-white/10" asChild>
            <Link to="/pickup-points">See pickup points</Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Documents handed in" value={docs.length} icon={FolderOpen} tone="blue" />
        <StatCard label="Returned to owners" value={returned} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Waiting for owners" value={docs.length - returned} icon={HeartHandshake} tone="violet" />
      </div>
      <div>
        <h2 className="mb-3 font-heading text-lg font-semibold text-slate-900">Documents you handed in</h2>
        {docs.length ? (
          <div className="space-y-3">
            {docs.slice(0, 8).map(function (doc) {
              return <DocumentRow key={doc.id} document={doc} pickupPointName={pointName(doc.pickup_point_id)} />;
            })}
          </div>
        ) : (
          <EmptyState icon={FolderOpen} title="Nothing handed in yet" description="Documents you register will be listed here with their status." />
        )}
      </div>
    </div>
  );
}

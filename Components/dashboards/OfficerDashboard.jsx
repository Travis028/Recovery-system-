import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import Loader from '@/components/Loader';
import DocumentRow from '@/components/documents/DocumentRow';
import { AlertTriangle, Archive, ClipboardCheck, FilePlus, FolderOpen, KeyRound } from 'lucide-react';

/** Station dashboard: only this officer's station. Numbers stay hidden until a record is opened. */
export default function OfficerDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState([]);
  const [pending, setPending] = useState(0);
  const [awaiting, setAwaiting] = useState(0);
  const [claims, setClaims] = useState(0);
  const [point, setPoint] = useState(null);

  useEffect(function () {
    let active = true;
    const load = async function () {
      const [docList, pendingCount, awaitingCount, claimCount, station] = await Promise.all([
        base44.entities.Document.filter({}, { sort: '-created_date', limit: 200 }),
        base44.entities.Match.count({ match_status: 'Pending' }),
        base44.entities.Match.count({ match_status: 'Confirmed' }),
        base44.entities.Claim.count({ status: 'Pending' }),
        user.pickup_point_id ? base44.entities.PickupPoint.get(user.pickup_point_id).catch(function () { return null; }) : null,
      ]);
      if (!active) return;
      setDocs(docList);
      setPending(pendingCount);
      setAwaiting(awaitingCount);
      setClaims(claimCount);
      setPoint(station);
      setLoading(false);
    };
    load();
    return function () { active = false; };
  }, [user.id, user.pickup_point_id]);

  if (loading) return <Loader label="Loading the station dashboard" />;

  const held = docs.filter(function (d) { return d.status !== 'Returned'; });
  const unclaimed = docs.filter(function (d) { return d.status === 'Unclaimed'; });
  const flagged = held.filter(function (d) { return d.duplicate_flag; });

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-violet-800 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Station dashboard</p>
        <h1 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">{point ? point.name : 'No station assigned'}</h1>
        <p className="mt-2 max-w-xl text-sm text-blue-100">
          {user.full_name}. You see only the documents held at this station. The screen signs out after 15 minutes without activity.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button className="gap-2 rounded-xl bg-white text-blue-900 hover:bg-blue-50" asChild>
            <Link to="/matches"><ClipboardCheck className="h-4 w-4" />Review matches and claims</Link>
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl border-white/40 bg-transparent text-white hover:bg-white/10" asChild>
            <Link to="/handover"><KeyRound className="h-4 w-4" />Handover</Link>
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl border-white/40 bg-transparent text-white hover:bg-white/10" asChild>
            <Link to="/report-found"><FilePlus className="h-4 w-4" />Register a document</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Documents held" value={held.length} icon={FolderOpen} tone="blue" />
        <StatCard label="Matches and claims to review" value={pending + claims} icon={ClipboardCheck} tone="amber" />
        <StatCard label="Awaiting collection" value={awaiting} icon={KeyRound} tone="emerald" />
        <StatCard label="Old unclaimed items" value={unclaimed.length} icon={Archive} tone="slate" hint="Held longer than the retention setting" />
      </div>

      {flagged.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 font-heading text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> {flagged.length} document(s) flagged as possible duplicates
          </p>
          <p className="mt-1 text-xs text-amber-900">Open each one to see why it was flagged before matching or releasing it.</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-heading text-lg font-semibold text-slate-900">Recently handed in</h2>
          {held.length ? (
            <div className="space-y-3">
              {held.slice(0, 6).map(function (doc) {
                return <DocumentRow key={doc.id} document={doc} />;
              })}
            </div>
          ) : (
            <EmptyState icon={FolderOpen} title="No documents held" description="Documents registered at this station appear here." />
          )}
        </div>
        <div>
          <h2 className="mb-3 font-heading text-lg font-semibold text-slate-900">Old unclaimed items</h2>
          {unclaimed.length ? (
            <div className="space-y-3">
              {unclaimed.slice(0, 6).map(function (doc) {
                return <DocumentRow key={doc.id} document={doc} />;
              })}
            </div>
          ) : (
            <EmptyState icon={Archive} title="Nothing overdue" description="Documents not collected within the agreed period are listed here for hand-over to the registration authority." />
          )}
        </div>
      </div>
    </div>
  );
}

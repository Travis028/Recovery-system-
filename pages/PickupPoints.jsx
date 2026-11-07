import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import PageHeader from '@/components/PageHeader';
import Loader from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit';
import { useToast } from '@/components/ui/use-toast';
import { BadgeCheck, Building2, Clock, Loader2, MapPin, Phone, Plus, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPES = ['Police station', "Chief's office", 'Other approved office'];
const BLANK = { name: '', point_type: 'Police station', location: '', county: '', contact_phone: '', opening_hours: '', verification_note: '' };

export default function PickupPoints() {
  const { user, role } = useLdrsUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const isAdmin = role === 'Admin';

  const load = async function () {
    setPoints(isAdmin ? await base44.entities.PickupPoint.list('name') : await base44.functions.invoke('listPublicPickupPoints'));
    setLoading(false);
  };
  useEffect(function () { if (user) load(); }, [user ? user.id : null, isAdmin]);

  if (loading) return <Loader label="Loading pickup points" />;

  const open = function (point) {
    setEditing(point || 'new');
    setForm(point ? { ...BLANK, ...point } : BLANK);
  };

  const save = async function (event) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = {
        name: form.name.trim(), point_type: form.point_type, location: form.location.trim(), county: form.county.trim(),
        contact_phone: form.contact_phone.trim(), opening_hours: form.opening_hours.trim(), verification_note: form.verification_note.trim(),
      };
      if (editing === 'new') {
        await base44.entities.PickupPoint.create({ ...data, verified: false, active: true });
        await logAction({ action: AUDIT_ACTIONS.PICKUP_POINT_CHANGE, details: 'Pickup point added (unverified): ' + data.name, user });
      } else {
        await base44.entities.PickupPoint.update(editing.id, data);
        await logAction({ action: AUDIT_ACTIONS.PICKUP_POINT_CHANGE, details: 'Pickup point edited: ' + data.name, user });
      }
      setEditing(null);
      await load();
    } catch (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async function (point, changes, description) {
    try {
      await base44.entities.PickupPoint.update(point.id, changes);
      await logAction({ action: AUDIT_ACTIONS.PICKUP_POINT_CHANGE, details: description + ': ' + point.name, user });
      await load();
    } catch (error) {
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Pickup points"
        description={isAdmin ? 'Only verified, active points can receive documents. Every change is logged.' : 'Collect or hand in documents only at these verified points. LDRS never asks for money.'}
        actions={isAdmin ? <Button className="gap-2 rounded-xl bg-blue-900 hover:bg-blue-950" onClick={function () { open(null); }}><Plus className="h-4 w-4" />Add pickup point</Button> : null}
      />
      {!isAdmin ? (
        <p className="mb-5 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Beware of fake collection points. If someone directs you to a place not listed here, or asks for payment, do not go — report it to the nearest police station.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {points.map(function (point) {
          return (
            <div key={point.id} className={cn('rounded-2xl border bg-white p-5 shadow-sm', point.active === false ? 'border-slate-200 opacity-60' : 'border-slate-200')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-800"><Building2 className="h-5 w-5" /></span>
                  <div>
                    <p className="font-heading text-sm font-semibold text-slate-900">{point.name}</p>
                    <p className="text-xs text-slate-500">{point.point_type} · {point.county} County</p>
                  </div>
                </div>
                {point.verified === false ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Not verified</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" />Verified</span>
                )}
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-slate-600">
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{point.location}</p>
                <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" />{point.opening_hours || 'Hours not set'}</p>
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{point.contact_phone || 'No contact'}</p>
              </div>
              {isAdmin ? (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                  {point.verification_note ? <p className="text-xs text-slate-500">Verification: {point.verification_note}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={function () { open(point); }}>Edit</Button>
                    {point.verified ? (
                      <Button size="sm" variant="outline" className="rounded-lg" onClick={function () { toggle(point, { verified: false }, 'Verification removed'); }}>Remove verification</Button>
                    ) : (
                      <Button size="sm" className="rounded-lg bg-emerald-600 hover:bg-emerald-700" onClick={function () { toggle(point, { verified: true, verified_at: new Date().toISOString() }, 'Pickup point verified with the station'); }}>Mark verified</Button>
                    )}
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={function () { toggle(point, { active: !point.active }, point.active ? 'Pickup point deactivated' : 'Pickup point reactivated'); }}>
                      {point.active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={function (o) { if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add a pickup point' : 'Edit pickup point'}</DialogTitle>
            <DialogDescription>New points stay unverified until you confirm them with the station (for example by calling the officer in charge).</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="pp_name">Name</Label><Input id="pp_name" value={form.name} onChange={function (e) { setForm({ ...form, name: e.target.value }); }} /></div>
            <div className="space-y-1">
              <Label htmlFor="pp_type">Type</Label>
              <Select value={form.point_type} onValueChange={function (v) { setForm({ ...form, point_type: v }); }}>
                <SelectTrigger id="pp_type"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(function (t) { return <SelectItem key={t} value={t}>{t}</SelectItem>; })}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label htmlFor="pp_county">County</Label><Input id="pp_county" value={form.county} onChange={function (e) { setForm({ ...form, county: e.target.value }); }} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="pp_location">Location</Label><Input id="pp_location" value={form.location} onChange={function (e) { setForm({ ...form, location: e.target.value }); }} /></div>
            <div className="space-y-1"><Label htmlFor="pp_hours">Opening hours</Label><Input id="pp_hours" value={form.opening_hours} placeholder="Mon–Fri, 08:00–17:00" onChange={function (e) { setForm({ ...form, opening_hours: e.target.value }); }} /></div>
            <div className="space-y-1"><Label htmlFor="pp_phone">Contact phone</Label><Input id="pp_phone" value={form.contact_phone} onChange={function (e) { setForm({ ...form, contact_phone: e.target.value }); }} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="pp_note">Verification note</Label><Textarea id="pp_note" rows={2} value={form.verification_note} placeholder="Who confirmed this point, and how" onChange={function (e) { setForm({ ...form, verification_note: e.target.value }); }} /></div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={function () { setEditing(null); }}>Cancel</Button>
              <Button type="submit" className="gap-2 rounded-xl bg-blue-900 hover:bg-blue-950" disabled={busy || !form.name || !form.location || !form.county}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from 'react';
import { BadgeCheck, Building2, Clock, Loader2, MapPin, Pencil, Phone, Plus, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import useResource from '@/hooks/useResource';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import DataTable from '@/components/data-table/DataTable';
import { SkeletonRows } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import FormField from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit';
import { useToast } from '@/components/ui/use-toast';
import useFieldErrors from '@/hooks/useFieldErrors';
import { checkContactPhone, checkMaxLength, checkRequired, collectErrors } from '@/lib/validation';

const TYPES = ['Police station', "Chief's office", 'Other approved office'];
const BLANK = { name: '', point_type: 'Police station', location: '', county: '', contact_phone: '', opening_hours: '', verification_note: '' };

function PublicPointCard({ point }) {
  return (
    <Card as="article">
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{point.name}</h2>
            <p className="text-xs text-muted-foreground">
              {point.point_type} · {point.county} County
            </p>
          </div>
          <Badge tone="success">
            <BadgeCheck aria-hidden="true" />
            Verified
          </Badge>
        </div>
        <dl className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Location</dt>
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dd>{point.location}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Opening hours</dt>
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dd>{point.opening_hours || 'Hours not set'}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Phone</dt>
            <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dd>{point.contact_phone || 'No contact number'}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export default function PickupPoints() {
  const { user, role } = useLdrsUser();
  const { toast } = useToast();
  const isAdmin = role === 'Admin';
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const fields = useFieldErrors(
    collectErrors({
      pp_name: () => checkRequired(form.name, 'Enter the name of the station or office.') || checkMaxLength(form.name, 120, 'The name'),
      pp_county: () => checkRequired(form.county, 'Enter the county.'),
      pp_location: () => checkRequired(form.location, 'Enter where the point is, such as the street or landmark.'),
      pp_hours: () => checkMaxLength(form.opening_hours, 80, 'Opening hours'),
      pp_phone: () => checkContactPhone(form.contact_phone),
      pp_note: () => checkMaxLength(form.verification_note, 500, 'The note'),
    }),
  );

  const { data: points, loading, error, reload } = useResource(
    function () {
      return isAdmin ? base44.entities.PickupPoint.list('name') : base44.functions.invoke('listPublicPickupPoints');
    },
    [user.id, isAdmin],
  );

  const open = function (point) {
    setEditing(point || 'new');
    setForm(point ? { ...BLANK, ...point } : BLANK);
    fields.reset();
  };

  const setField = function (field, value) {
    setForm(function (previous) {
      return { ...previous, [field]: value };
    });
  };

  const save = async function (event) {
    event.preventDefault();
    if (!fields.submit()) return;
    setBusy(true);
    try {
      const data = {
        name: form.name.trim(),
        point_type: form.point_type,
        location: form.location.trim(),
        county: form.county.trim(),
        contact_phone: form.contact_phone.trim(),
        opening_hours: form.opening_hours.trim(),
        verification_note: form.verification_note.trim(),
      };
      if (editing === 'new') {
        await base44.entities.PickupPoint.create({ ...data, verified: false, active: true });
        await logAction({ action: AUDIT_ACTIONS.PICKUP_POINT_CHANGE, details: 'Pickup point added (unverified): ' + data.name, user });
      } else {
        await base44.entities.PickupPoint.update(editing.id, data);
        await logAction({ action: AUDIT_ACTIONS.PICKUP_POINT_CHANGE, details: 'Pickup point edited: ' + data.name, user });
      }
      toast({ tone: 'success', title: editing === 'new' ? 'Pickup point added' : 'Pickup point saved', description: data.name });
      setEditing(null);
      reload();
    } catch (saveError) {
      toast({ tone: 'danger', title: 'Could not save the pickup point', description: saveError.message });
    } finally {
      setBusy(false);
    }
  };

  const change = async function (point, changes, description) {
    try {
      await base44.entities.PickupPoint.update(point.id, changes);
      await logAction({ action: AUDIT_ACTIONS.PICKUP_POINT_CHANGE, details: description + ': ' + point.name, user });
      toast({ tone: 'success', title: description, description: point.name });
      reload();
    } catch (changeError) {
      toast({ tone: 'danger', title: 'Could not update the pickup point', description: changeError.message });
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Pickup point',
      sortValue: (point) => point.name,
      cell: function (point) {
        return (
          <div className="min-w-[12rem]">
            <p className="font-medium">{point.name}</p>
            <p className="text-xs text-muted-foreground">
              {point.point_type} · {point.location}
            </p>
          </div>
        );
      },
    },
    { key: 'county', header: 'County', sortValue: (point) => point.county, cell: (point) => point.county },
    {
      key: 'contact',
      header: 'Hours and contact',
      cell: function (point) {
        return (
          <div className="text-xs text-muted-foreground">
            <p>{point.opening_hours || 'Hours not set'}</p>
            <p>{point.contact_phone || 'No contact number'}</p>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (point) => (point.verified ? 1 : 0) + (point.active ? 2 : 0),
      cell: function (point) {
        return (
          <div className="flex flex-wrap gap-1.5">
            {point.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Not verified</Badge>}
            {point.active ? null : <Badge tone="neutral">Inactive</Badge>}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: function (point) {
        return (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={function () { open(point); }} aria-label={'Edit ' + point.name}>
              <Pencil aria-hidden="true" />
              Edit
            </Button>
            {point.verified ? (
              <Button size="sm" variant="secondary" onClick={function () { change(point, { verified: false }, 'Verification removed'); }}>
                Remove verification
              </Button>
            ) : (
              <Button size="sm" variant="success" onClick={function () { change(point, { verified: true, verified_at: new Date().toISOString() }, 'Pickup point verified'); }}>
                Mark verified
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={function () {
                change(point, { active: !point.active }, point.active ? 'Pickup point deactivated' : 'Pickup point reactivated');
              }}
            >
              {point.active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Pickup points"
        description={
          isAdmin
            ? 'Only verified, active points can receive documents. Every change is recorded in the audit trail.'
            : 'Hand in or collect documents only at these verified points. LDRS never asks for payment.'
        }
        actions={
          isAdmin ? (
            <Button onClick={function () { open(null); }}>
              <Plus aria-hidden="true" />
              Add pickup point
            </Button>
          ) : null
        }
      />

      {!isAdmin ? (
        <Alert tone="warning" icon={ShieldAlert} title="Beware of fake collection points" className="mb-section">
          If someone sends you to a place that is not listed here, or asks for money, do not go. Report it at the nearest police station.
        </Alert>
      ) : null}

      {loading && !points ? (
        <SkeletonRows label="Loading pickup points" />
      ) : error ? (
        <ErrorState title="Pickup points could not be loaded" error={error} onRetry={reload} />
      ) : !points.length ? (
        <EmptyState icon={Building2} title="No pickup points yet" description={isAdmin ? 'Add the first station or office that will hold documents.' : 'No verified pickup points are listed yet.'} />
      ) : isAdmin ? (
        <DataTable
          caption="Pickup points"
          columns={columns}
          rows={points}
          rowKey={(point) => point.id}
          initialSort={{ key: 'name', direction: 'asc' }}
          search={{ label: 'Search pickup points', placeholder: 'Search by name, county or location', text: (point) => [point.name, point.county, point.location].join(' ') }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {points.map(function (point) {
            return <PublicPointCard key={point.id} point={point} />;
          })}
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={function (isOpen) { if (!isOpen) setEditing(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add a pickup point' : 'Edit pickup point'}</DialogTitle>
            <DialogDescription>New points stay unverified until you confirm them with the station, for example by calling the officer in charge.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={save} noValidate>
            <FormField error={fields.show('pp_name')} id="pp_name" label="Name" className="sm:col-span-2">
              <Input value={form.name} onBlur={fields.touch('pp_name')} onChange={function (e) { setField('name', e.target.value); }} />
            </FormField>
            <FormField id="pp_type" label="Type">
              <Select value={form.point_type} onValueChange={function (value) { setField('point_type', value); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map(function (type) {
                    return (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </FormField>
            <FormField error={fields.show('pp_county')} id="pp_county" label="County">
              <Input value={form.county} onBlur={fields.touch('pp_county')} onChange={function (e) { setField('county', e.target.value); }} />
            </FormField>
            <FormField error={fields.show('pp_location')} id="pp_location" label="Location" className="sm:col-span-2">
              <Input value={form.location} onBlur={fields.touch('pp_location')} onChange={function (e) { setField('location', e.target.value); }} />
            </FormField>
            <FormField id="pp_hours" label="Opening hours" optional error={fields.show('pp_hours')}>
              <Input value={form.opening_hours} placeholder="Mon–Fri, 08:00–17:00" onChange={function (e) { setField('opening_hours', e.target.value); }} />
            </FormField>
            <FormField id="pp_phone" label="Contact phone" optional error={fields.show('pp_phone')}>
              <Input value={form.contact_phone} inputMode="tel" onBlur={fields.touch('pp_phone')} onChange={function (e) { setField('contact_phone', e.target.value); }} />
            </FormField>
            <FormField id="pp_note" label="Verification note" hint="Who confirmed this point, and how." optional error={fields.show('pp_note')} className="sm:col-span-2">
              <Textarea rows={2} value={form.verification_note} onChange={function (e) { setField('verification_note', e.target.value); }} />
            </FormField>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="secondary" onClick={function () { setEditing(null); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from 'react';
import { Lock, ShieldCheck, Users as UsersIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useLdrsUser from '@/hooks/useLdrsUser';
import useResource from '@/hooks/useResource';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import DataTable from '@/components/data-table/DataTable';
import FilterChips from '@/components/ui/filter-chips';
import { SkeletonRows } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_LABELS, formatDate, maskPhone, resolveRole } from '@/lib/ldrs';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit';
import { useToast } from '@/components/ui/use-toast';

const FILTERS = [
  ['all', 'All'],
  ['pending', 'Awaiting approval'],
  ['locked', 'Locked'],
  ['Officer', 'Officers'],
  ['Owner', 'Owners'],
  ['Finder', 'Finders'],
  ['Admin', 'Admins'],
];

function isLocked(account) {
  return Boolean(account.locked_until) && new Date(account.locked_until).getTime() > Date.now();
}

function matchesFilter(account, filter) {
  const role = resolveRole(account);
  if (filter === 'pending') return role === 'Officer' && !account.approved;
  if (filter === 'locked') return isLocked(account);
  return filter === 'all' || role === filter;
}

function UsersContent() {
  const { user: me } = useLdrsUser();
  const { toast } = useToast();
  const [filter, setFilter] = useState('all');
  const { data, loading, error, reload } = useResource(function () {
    return Promise.all([base44.entities.User.list('-created_date'), base44.entities.PickupPoint.list('name')]);
  }, []);

  if (loading && !data) return <SkeletonRows label="Loading accounts" />;
  if (error) return <ErrorState title="Accounts could not be loaded" error={error} onRetry={reload} />;

  const [users, points] = data;
  const stations = points.filter(function (point) {
    return point.verified && point.active;
  });
  const pointName = function (id) {
    const point = points.find(function (item) {
      return item.id === id;
    });
    return point ? point.name : 'No station';
  };

  const change = async function (target, changes, description) {
    try {
      await base44.entities.User.update(target.id, changes);
      await logAction({ action: AUDIT_ACTIONS.USER_CHANGE, details: description + ' — ' + target.email, user: me });
      toast({ tone: 'success', title: 'Account updated', description });
      reload();
    } catch (changeError) {
      toast({ tone: 'danger', title: 'Could not update the account', description: changeError.message });
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Account',
      sortValue: (account) => account.full_name,
      cell: function (account) {
        return (
          <div className="min-w-[12rem]">
            <p className="font-medium">
              {account.full_name}
              {account.id === me.id ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">{account.email}</p>
          </div>
        );
      },
    },
    {
      key: 'role',
      header: 'Role',
      sortValue: (account) => ROLE_LABELS[resolveRole(account)] || '',
      cell: (account) => <Badge tone="primary">{ROLE_LABELS[resolveRole(account)] || 'No role'}</Badge>,
    },
    {
      key: 'station',
      header: 'Station',
      sortValue: (account) => (resolveRole(account) === 'Officer' ? pointName(account.pickup_point_id) : ''),
      cell: function (account) {
        if (resolveRole(account) !== 'Officer') return <span className="text-muted-foreground">—</span>;
        if (account.id === me.id) return pointName(account.pickup_point_id);
        return (
          <Select
            value={account.pickup_point_id || ''}
            onValueChange={function (value) {
              change(account, { pickup_point_id: value }, 'Station set to ' + pointName(value));
            }}
          >
            <SelectTrigger className="h-8 min-w-[13rem] text-xs" aria-label={'Station for ' + account.full_name}>
              <SelectValue placeholder="Assign a station" />
            </SelectTrigger>
            <SelectContent>
              {stations.map(function (point) {
                return (
                  <SelectItem key={point.id} value={point.id}>
                    {point.name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: function (account) {
        if (!account.phone) return <span className="text-muted-foreground">None</span>;
        return (
          <div className="whitespace-nowrap">
            <span className="font-mono text-xs">{maskPhone(account.phone)}</span>
            <p className="text-xs text-muted-foreground">{account.phone_verified ? 'Verified' : 'Not verified'}</p>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: function (account) {
        const role = resolveRole(account);
        return (
          <div className="flex flex-wrap gap-1.5">
            {role === 'Officer' ? <Badge tone={account.approved ? 'success' : 'warning'}>{account.approved ? 'Approved' : 'Awaiting approval'}</Badge> : null}
            {isLocked(account) ? (
              <Badge tone="danger">
                <Lock aria-hidden="true" />
                Locked
              </Badge>
            ) : null}
            {account.disabled ? <Badge tone="neutral">Disabled</Badge> : null}
            {role !== 'Officer' && !isLocked(account) && !account.disabled ? <Badge tone="success">Active</Badge> : null}
          </div>
        );
      },
    },
    { key: 'joined', header: 'Joined', sortValue: (account) => account.created_date, cell: (account) => <span className="whitespace-nowrap">{formatDate(account.created_date)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: function (account) {
        if (account.id === me.id) return null;
        const role = resolveRole(account);
        return (
          <div className="flex justify-end gap-1.5">
            {role === 'Officer' && !account.approved ? (
              <Button
                size="sm"
                variant="success"
                disabled={!account.pickup_point_id || !account.phone}
                title={!account.pickup_point_id || !account.phone ? 'Assign a station and make sure a phone number is on the account first' : undefined}
                onClick={function () {
                  change(account, { approved: true, phone_verified: true }, 'Officer approved for ' + pointName(account.pickup_point_id) + ' (identity and phone confirmed with the station)');
                }}
              >
                <ShieldCheck aria-hidden="true" />
                Approve
              </Button>
            ) : null}
            {role === 'Officer' && account.approved ? (
              <Button size="sm" variant="secondary" onClick={function () { change(account, { approved: false }, 'Officer approval withdrawn'); }}>
                Withdraw approval
              </Button>
            ) : null}
            {isLocked(account) ? (
              <Button size="sm" variant="secondary" onClick={function () { change(account, { locked_until: '', failed_logins: 0 }, 'Account unlocked'); }}>
                Unlock
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={account.disabled ? 'secondary' : 'danger-outline'}
              onClick={function () {
                change(account, { disabled: !account.disabled }, account.disabled ? 'Account enabled' : 'Account disabled');
              }}
            >
              {account.disabled ? 'Enable' : 'Disable'}
            </Button>
          </div>
        );
      },
    },
  ];

  const rows = users.filter(function (account) {
    return matchesFilter(account, filter);
  });

  return (
    <DataTable
      caption="User accounts"
      columns={columns}
      rows={rows}
      rowKey={(account) => account.id}
      initialSort={{ key: 'joined', direction: 'desc' }}
      search={{ label: 'Search accounts', placeholder: 'Search by name or email', text: (account) => account.full_name + ' ' + account.email }}
      emptyState={users.length ? undefined : <EmptyState icon={UsersIcon} title="No accounts yet" />}
      toolbar={
        <FilterChips
          label="Filter accounts"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map(function (item) {
            return {
              value: item[0],
              label: item[1],
              count: users.filter(function (account) {
                return matchesFilter(account, item[0]);
              }).length,
            };
          })}
        />
      }
    />
  );
}

export default function Users() {
  return (
    <>
      <PageHeader title="Users and roles" description="Approve officers, assign each one to a station, and unlock or disable accounts. Every change is logged." />
      <UsersContent />
    </>
  );
}

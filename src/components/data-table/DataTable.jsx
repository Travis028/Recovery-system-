import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function compare(left, right) {
  if (left === right) return 0;
  if (left === undefined || left === null || left === '') return 1;
  if (right === undefined || right === null || right === '') return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Table with sortable columns.
 *
 * columns: [{ key, header, cell(row), sortValue?(row), className?, align? }]
 * A column is sortable when it has sortValue. initialSort: { key, direction: 'asc' | 'desc' }.
 */
export default function DataTable({ columns, rows, rowKey, caption, initialSort, emptyState }) {
  const [sort, setSort] = useState(initialSort || null);

  const sorted = useMemo(
    function () {
      if (!sort) return rows;
      const column = columns.find(function (item) {
        return item.key === sort.key;
      });
      if (!column || !column.sortValue) return rows;
      const factor = sort.direction === 'desc' ? -1 : 1;
      return rows.slice().sort(function (a, b) {
        return compare(column.sortValue(a), column.sortValue(b)) * factor;
      });
    },
    [rows, columns, sort],
  );

  const toggleSort = function (key) {
    setSort(function (current) {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  if (!rows.length && emptyState) return emptyState;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="border-b border-border bg-muted/60">
            <tr>
              {columns.map(function (column) {
                const active = sort && sort.key === column.key;
                const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : column.sortValue ? 'none' : undefined;
                const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      'whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground',
                      column.align === 'right' && 'text-right',
                      column.headerClassName,
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={function () {
                          toggleSort(column.key);
                        }}
                        className={cn(
                          '-mx-1 inline-flex items-center gap-1 rounded-sm px-1 uppercase tracking-wide hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          active && 'text-foreground',
                        )}
                      >
                        {column.header}
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map(function (row) {
              return (
                <tr key={rowKey(row)} className="transition-colors hover:bg-muted/40">
                  {columns.map(function (column) {
                    return (
                      <td key={column.key} className={cn('px-4 py-3 align-middle text-foreground', column.align === 'right' && 'text-right', column.className)}>
                        {column.cell(row)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useId, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, SearchX } from 'lucide-react';
import { SearchInput } from '@/components/ui/search-input';
import Pagination from '@/components/data-table/Pagination';
import { cn } from '@/lib/utils';

function compare(left, right) {
  if (left === right) return 0;
  if (left === undefined || left === null || left === '') return 1;
  if (right === undefined || right === null || right === '') return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Table with sortable columns, an optional search box and pagination.
 *
 * columns: [{ key, header, cell(row), sortValue?(row), className?, align? }]
 * A column is sortable when it has sortValue. initialSort: { key, direction: 'asc' | 'desc' }.
 * search: { label, placeholder, text(row) } filters rows by the text it returns.
 * toolbar: extra filters shown next to the search box.
 */
export default function DataTable({ columns, rows, rowKey, caption, initialSort, emptyState, search, toolbar, pageSize = 10 }) {
  const searchId = useId();
  const [sort, setSort] = useState(initialSort || null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    function () {
      const term = query.trim().toLowerCase();
      if (!search || !term) return rows;
      return rows.filter(function (row) {
        return String(search.text(row) || '').toLowerCase().indexOf(term) >= 0;
      });
    },
    [rows, query, search],
  );

  // Go back to the first page when the search or the set of rows changes. Callers often
  // pass a freshly filtered array on every render, so the length is compared, not the array.
  const rowCount = rows.length;
  useEffect(
    function () {
      setPage(1);
    },
    [query, rowCount],
  );

  const sorted = useMemo(
    function () {
      if (!sort) return filtered;
      const column = columns.find(function (item) {
        return item.key === sort.key;
      });
      if (!column || !column.sortValue) return filtered;
      const factor = sort.direction === 'desc' ? -1 : 1;
      return filtered.slice().sort(function (a, b) {
        return compare(column.sortValue(a), column.sortValue(b)) * factor;
      });
    },
    [filtered, columns, sort],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = function (key) {
    setSort(function (current) {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  if (!rows.length && emptyState) return emptyState;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {search || toolbar ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
          {search ? (
            <SearchInput
              id={searchId}
              label={search.label}
              placeholder={search.placeholder}
              value={query}
              className="min-w-[14rem] flex-1"
              onChange={function (event) {
                setQuery(event.target.value);
              }}
            />
          ) : null}
          {toolbar}
        </div>
      ) : null}
      {!visible.length ? (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
          <SearchX className="h-5 w-5" aria-hidden="true" />
          No rows match. Try another search or filter.
        </div>
      ) : (
        <div className="relative overflow-x-auto">
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
            {visible.map(function (row) {
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
      )}
      <Pagination page={currentPage} pageCount={pageCount} total={sorted.length} pageSize={pageSize} onPageChange={setPage} />
    </div>
  );
}

import { useDeferredValue, useState } from 'react';
import {
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';

/**
 * Tabela padrão do HUB: TanStack Table + busca + paginação com ícones + scroll.
 * serverPagination: dados já paginados no servidor; totalRowCount/pageCount vêm do pai.
 */
export function EntityDataTable({
  data,
  columns,
  getRowId,
  searchPlaceholder = 'Buscar…',
  pageSize = 10,
  emptyLabel = 'Nenhum registro.',
  className = '',
  serverPagination = false,
  pageIndex: serverPageIndex = 0,
  onPageIndexChange,
  totalRowCount = 0,
  pageCount: serverPageCount = 0,
  searchValue: controlledSearch,
  onSearchChange,
}) {
  const [globalFilter, setGlobalFilter] = useState('');
  const search = controlledSearch !== undefined ? controlledSearch : globalFilter;
  /** Filtro adiado: evita `JSON.stringify` em todas as linhas a cada tecla (travava com tabelas grandes). */
  const deferredFilter = useDeferredValue(search);

  const table = useReactTable({
    data,
    columns,
    getRowId,
    ...(serverPagination
      ? {
          manualPagination: true,
          pageCount: Math.max(1, serverPageCount || 1),
          state: {
            globalFilter: deferredFilter,
            pagination: { pageIndex: serverPageIndex, pageSize },
          },
          onGlobalFilterChange: (updater) => {
            const next = typeof updater === 'function' ? updater(search) : updater;
            onSearchChange?.(next);
          },
          onPaginationChange: (updater) => {
            const next = functionalUpdate(updater, { pageIndex: serverPageIndex, pageSize });
            onPageIndexChange?.(next.pageIndex);
          },
          getCoreRowModel: getCoreRowModel(),
        }
      : {
          state: { globalFilter: deferredFilter },
          onGlobalFilterChange: (updater) => {
            const next = typeof updater === 'function' ? updater(search) : updater;
            if (onSearchChange) onSearchChange(next);
            else setGlobalFilter(next);
          },
          getCoreRowModel: getCoreRowModel(),
          getFilteredRowModel: getFilteredRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageSize } },
          globalFilterFn: (row, _columnId, filterValue) => {
            const q = String(filterValue || '')
              .trim()
              .toLowerCase();
            if (!q) return true;
            const v = JSON.stringify(row.original).toLowerCase();
            return v.includes(q);
          },
        }),
  });

  const pageIndex = serverPagination ? serverPageIndex : table.getState().pagination.pageIndex;
  const pageSizeState = serverPagination ? pageSize : table.getState().pagination.pageSize;
  const filteredCount = serverPagination ? totalRowCount : table.getFilteredRowModel().rows.length;
  const pageCount = serverPagination ? Math.max(1, serverPageCount || 1) : table.getPageCount();
  const canPrev = serverPagination ? pageIndex > 0 : table.getCanPreviousPage();
  const canNext = serverPagination ? pageIndex + 1 < pageCount : table.getCanNextPage();

  const pageInfo = {
    from: filteredCount === 0 ? 0 : pageIndex * pageSizeState + 1,
    to: Math.min((pageIndex + 1) * pageSizeState, filteredCount),
    total: filteredCount,
  };
  const showPagination = pageCount > 1;

  function goFirst() {
    if (serverPagination) onPageIndexChange?.(0);
    else table.setPageIndex(0);
  }
  function goPrev() {
    if (serverPagination) onPageIndexChange?.(Math.max(0, pageIndex - 1));
    else table.previousPage();
  }
  function goNext() {
    if (serverPagination) onPageIndexChange?.(Math.min(pageCount - 1, pageIndex + 1));
    else table.nextPage();
  }
  function goLast() {
    if (serverPagination) onPageIndexChange?.(Math.max(0, pageCount - 1));
    else table.setPageIndex(Math.max(0, pageCount - 1));
  }

  return (
    <div className={`min-w-0 w-full space-y-4 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="sr-only" htmlFor="entity-table-search">
          {searchPlaceholder}
        </label>
        <input
          id="entity-table-search"
          type="search"
          value={search ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            if (onSearchChange) onSearchChange(v);
            else {
              setGlobalFilter(v);
              table.setPageIndex(0);
            }
          }}
          placeholder={searchPlaceholder}
          className="w-full max-w-md rounded-none border border-slate-200/90 bg-sky-50/50 px-4 py-2.5 text-sm text-primary placeholder:text-on-surface-variant/60 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary/20"
        />
        <p className="shrink-0 text-[10px] font-black uppercase tracking-wider text-on-surface-variant tabular-nums">
          {pageInfo.total} registro(s)
        </p>
      </div>

      <div className="hub-table-scrollbar max-h-[min(55vh,560px)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200/90 bg-slate-50/50 shadow-inner">
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 border-b-2 border-slate-200/80 bg-slate-100/95 text-[10px] font-black uppercase tracking-wider text-slate-600 backdrop-blur-sm">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className={`whitespace-nowrap px-4 py-3.5 text-left font-black sm:px-5 sm:py-4 ${h.column.columnDef.meta?.tdClassName ?? ''}`}
                  >
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-200/60 bg-white">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-on-surface-variant sm:px-6">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, i) => (
                <tr key={row.id} className={i % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`align-middle px-4 py-3.5 text-primary sm:px-5 sm:py-4 ${cell.column.columnDef.meta?.tdClassName ?? ''}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <p className="text-[11px] text-on-surface-variant tabular-nums">
            {pageInfo.from}–{pageInfo.to} de {pageInfo.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goFirst}
              disabled={!canPrev}
              className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-sky-300 bg-sky-50 text-primary transition hover:bg-sky-100 disabled:opacity-40"
              aria-label="Primeira página"
            >
              <span className="material-symbols-outlined text-[18px]">first_page</span>
            </button>
            <button
              type="button"
              onClick={goPrev}
              disabled={!canPrev}
              className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-sky-300 bg-sky-50 text-primary transition hover:bg-sky-100 disabled:opacity-40"
              aria-label="Página anterior"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="min-w-[4rem] px-2 text-center text-[11px] font-medium tabular-nums text-on-surface-variant">
              {pageIndex + 1} / {Math.max(1, pageCount || 1)}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-sky-300 bg-sky-50 text-primary transition hover:bg-sky-100 disabled:opacity-40"
              aria-label="Próxima página"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
            <button
              type="button"
              onClick={goLast}
              disabled={!canNext}
              className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-sky-300 bg-sky-50 text-primary transition hover:bg-sky-100 disabled:opacity-40"
              aria-label="Última página"
            >
              <span className="material-symbols-outlined text-[18px]">last_page</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

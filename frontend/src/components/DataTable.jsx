import { useEffect, useMemo, useState } from 'react';

function defaultGetCell(row, col) {
  const v = row[col.key];
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return String(v);
  return String(v);
}

/**
 * Tabela com busca client-side, paginação e coluna de ações opcional.
 */
export function DataTable({
  columns,
  rows,
  getRowId = (r) => r.id,
  searchKeys = [],
  searchPlaceholder = 'Buscar…',
  pageSize = 10,
  emptyLabel = 'Nenhum registro.',
  renderActions,
  className = '',
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || !searchKeys.length) return rows;
    return rows.filter((row) =>
      searchKeys.some((key) => {
        const v = row[key];
        if (v == null) return false;
        return String(v).toLowerCase().includes(s);
      })
    );
  }, [rows, q, searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [filtered.length, totalPages]);

  const pageRows = useMemo(() => {
    const start = safePage * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const showSearch = searchKeys.length > 0;

  return (
    <div className={`space-y-3 min-w-0 ${className}`}>
      {showSearch ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
          <label className="sr-only" htmlFor="datatable-search">
            {searchPlaceholder}
          </label>
          <input
            id="datatable-search"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="w-full sm:max-w-xs border border-surface-container-high px-3 py-2 text-sm font-mono"
          />
          <p className="text-[10px] font-black uppercase text-on-surface-variant tabular-nums">
            {filtered.length} registro(s)
          </p>
        </div>
      ) : null}

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[280px] table-fixed text-left text-sm">
          <thead className="bg-surface-container-low text-[10px] font-black uppercase text-on-surface-variant">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-3 py-3 ${col.thClassName || ''}`}>
                  {col.header}
                </th>
              ))}
              {renderActions ? <th className="px-3 py-3 w-[120px]">Ações</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-high">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (renderActions ? 1 : 0)} className="px-3 py-8 text-on-surface-variant text-sm">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={String(getRowId(row))} className="hover:bg-surface-container-low/50 align-top">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-3 py-3 min-w-0 ${col.tdClassName || ''}`}>
                      {col.render ? col.render(row) : defaultGetCell(row, col)}
                    </td>
                  ))}
                  {renderActions ? <td className="px-3 py-3 align-top">{renderActions(row)}</td> : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[10px] text-on-surface-variant font-mono">
            Página {safePage + 1} / {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="text-[10px] font-black uppercase tracking-widest border border-primary px-3 py-1.5 disabled:opacity-40 hover:bg-primary hover:text-white"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="text-[10px] font-black uppercase tracking-widest border border-primary px-3 py-1.5 disabled:opacity-40 hover:bg-primary hover:text-white"
            >
              Próxima
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

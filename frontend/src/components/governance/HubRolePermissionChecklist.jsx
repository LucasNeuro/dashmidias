const MODULO_LABELS_PT = /** @type {Record<string, string>} */ ({
  hub_access: 'Acesso ao HUB',
  governance: 'Governança',
  audit: 'Auditoria',
  crm: 'CRM',
  templates: 'Templates e formulários',
});

/** @param {string} modulo */
export function hubModuloDisplayLabel(modulo) {
  const k = String(modulo || 'geral');
  return MODULO_LABELS_PT[k] || k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
}

/**
 * Lista agrupada por módulo (alinhado a `hub_admin_permission.modulo`).
 * @param {{
 *   permByModule: Array<[string, Array<{ id: string, codigo: string, acao?: string, descricao?: string | null }>]>,
 *   selectedPermIds: string[],
 *   onToggle: (permissionId: string, checked: boolean) => void,
 *   disabled?: boolean,
 *   showIntro?: boolean,
 * }} props
 */
export function HubRolePermissionChecklist({ permByModule, selectedPermIds, onToggle, disabled = false, showIntro = true }) {
  return (
    <div className="space-y-2">
      {showIntro ? (
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Permissões</h3>
          <p className="mt-1 text-xs leading-snug text-on-surface-variant">Marque os acessos e ações que este cargo terá em cada módulo.</p>
        </div>
      ) : null}
      <div
        className="max-h-[min(420px,calc(100vh-320px))] overflow-y-auto rounded-lg border border-slate-200/90 bg-white p-3 shadow-inner shadow-slate-900/[0.02]"
        role="group"
        aria-label="Permissões por módulo"
      >
        {permByModule.length === 0 ? (
          <p className="text-sm text-amber-800">
            Nenhuma permissão ativa encontrada na base. Rode o seed SQL em <code className="font-mono text-xs">hub_admin_roles_permissions.sql</code> (tabela{' '}
            <code className="font-mono text-xs">hub_admin_permission</code>).
          </p>
        ) : (
          <div className="space-y-4">
            {permByModule.map(([mod, list]) => (
              <div key={mod}>
                <h4 className="border-b border-slate-100 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600">{hubModuloDisplayLabel(mod)}</h4>
                <ul className="mt-2 space-y-2">
                  {list.map((perm) => {
                    const pid = String(perm.id);
                    const checked = selectedPermIds.includes(pid);
                    return (
                      <li key={pid}>
                        <label className={`flex cursor-pointer items-start gap-2.5 rounded-sm px-1 py-0.5 text-sm text-slate-800 ${checked ? 'bg-primary/5 ring-1 ring-primary/10' : 'hover:bg-slate-50'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            className="mt-1 h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            onChange={(e) => onToggle(pid, e.target.checked)}
                          />
                          <span>
                            <span className="font-semibold">{perm.codigo}</span>
                            {perm.descricao ? <span className="mt-0.5 block text-xs font-normal leading-relaxed text-on-surface-variant">{perm.descricao}</span> : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

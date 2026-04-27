import { AppSideover } from '../AppSideover';
import { HubButton } from '../HubButton';

/**
 * Formulário de seção do catálogo padrão.
 * A etapa no cadastro público usa o mesmo slug desta seção; só escolhe o bloco (comercial vs. logística).
 * @param {string} publicWizardUrl — URL do cadastro público (link "(LINK)").
 */
export function StandardCatalogSectionSideover({
  open,
  onClose,
  isNew,
  title,
  setTitle,
  partitionBucket,
  setPartitionBucket,
  publicWizardUrl,
  sortOrder,
  setSortOrder,
  isActive,
  setIsActive,
  slugPreview,
  slugReadonly,
  onSave,
  busy,
}) {
  const canSave = title.trim().length > 0;
  const href =
    publicWizardUrl ||
    (typeof window !== 'undefined' ? `${window.location.origin}/#/cadastro/organizacao` : '#');

  return (
    <AppSideover
      open={open}
      onClose={onClose}
      variant="operational"
      eyebrow="Catálogo de campos padrão"
      title={isNew ? 'Nova seção' : 'Editar seção'}
      subtitle={slugReadonly ? `slug: ${slugReadonly}` : slugPreview ? `slug: ${slugPreview}` : undefined}
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 p-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="space-y-5">
            <p className="text-xs leading-relaxed text-slate-600">
              Cada <strong>seção</strong> corresponde a um grupo de campos e a uma entrada no cadastro público. O identificador
              técnico da etapa é o <strong>mesmo slug</strong> da seção — não precisa criar etapas à parte.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Título da seção *
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Ex.: Documentação legal"
              />
            </label>
            <div className="block">
              <span className="mb-1.5 flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <span>Onde aparece no wizard público</span>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-black normal-case text-primary underline-offset-2 hover:underline"
                  title="Abre o cadastro público num novo separador"
                >
                  &quot;(LINK)&quot;
                </a>
              </span>
              <select
                value={partitionBucket === 'logistics' ? 'logistics' : 'commercial'}
                onChange={(e) => setPartitionBucket(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option value="commercial">Informações comerciais (com produto / atuação)</option>
                <option value="logistics">Logística e doca</option>
              </select>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                O formulário público ainda tem <strong>dois painéis</strong> de campos extra; esta opção só indica em qual deles
                entram os campos desta seção.
              </p>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Ordem (sort)
              </span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full max-w-[8rem] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              <span className="text-sm font-medium text-slate-700">Seção ativa no catálogo</span>
            </label>
            {isNew && slugPreview ? (
              <p className="text-xs leading-relaxed text-slate-500">
                O slug da seção (e da etapa no público) será{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5">{slugPreview}</code>.
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] sm:px-6">
          <div className="flex flex-wrap gap-3">
            <HubButton variant="secondary" icon="close" onClick={onClose} className="!text-xs !font-semibold !tracking-wide">
              Cancelar
            </HubButton>
            <HubButton
              variant="primary"
              icon={isNew ? 'add' : 'save'}
              disabled={!canSave || busy}
              onClick={() => void onSave?.()}
              className="!text-xs !font-semibold !tracking-wide"
            >
              {busy ? 'Salvando…' : isNew ? 'Criar seção' : 'Salvar alterações'}
            </HubButton>
          </div>
        </div>
      </div>
    </AppSideover>
  );
}

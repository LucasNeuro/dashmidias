import { AppSideover } from '../AppSideover';
import { HubButton } from '../HubButton';

/**
 * Formulário de grupo do catálogo de campos.
 * O cadastro público usa uma etapa por grupo, na mesma ordem configurada nas «Etapas no cadastro público».
 * @param {string} publicWizardUrl — URL do cadastro público (preview).
 */
export function StandardCatalogSectionSideover({
  open,
  onClose,
  isNew,
  title,
  setTitle,
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
      eyebrow="Campos"
      title={isNew ? 'Novo grupo' : 'Editar grupo'}
      subtitle={slugReadonly ? `slug: ${slugReadonly}` : slugPreview ? `slug: ${slugPreview}` : undefined}
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 p-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="space-y-5">
            <p className="text-xs leading-relaxed text-slate-600">
              Cada grupo é <strong>uma etapa própria</strong> no cadastro público (nome e código alinhados). Use a secção{' '}
              <strong>Etapas no cadastro público</strong> mais abaixo para ordem e para ligar ou desligar uma etapa inteira.{' '}
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline-offset-2 hover:underline"
                title="Abrir cadastro público para conferir os passos"
              >
                Pré-visualizar cadastro
              </a>
            </p>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Nome do grupo *
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Ex.: Documentação legal"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Ordem na lista
              </span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full max-w-[8rem] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              <span className="text-sm font-medium leading-snug text-slate-700">
                Etapa <strong>ligada</strong> nos modelos que usam estes campos. Se estiver{' '}
                <strong className="text-slate-900">desligada</strong>, esta etapa e estes campos <strong>não aparecem</strong> em
                nenhum formulário público até voltar a ligar.
              </span>
            </label>
            {isNew && slugPreview ? (
              <p className="text-xs leading-relaxed text-slate-500">
                O código interno do grupo (e da etapa no cadastro público) será{' '}
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
              {busy ? 'Salvando…' : isNew ? 'Criar grupo' : 'Salvar alterações'}
            </HubButton>
          </div>
        </div>
      </div>
    </AppSideover>
  );
}

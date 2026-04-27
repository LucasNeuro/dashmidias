import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { useAuth } from '../context/AuthContext';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { EntityDataTable } from '../components/EntityDataTable';
import { HubButton } from '../components/HubButton';
import { StandardCatalogFieldSideover } from '../components/governance/StandardCatalogFieldSideover';
import { StandardCatalogSectionSideover } from '../components/governance/StandardCatalogSectionSideover';
import {
  countFieldsInSection,
  deleteHubStandardField,
  deleteHubStandardSection,
  deleteSignupWizardStepBySlug,
  fetchHubStandardCatalogAdmin,
  insertHubStandardField,
  insertHubStandardSection,
  updateHubStandardField,
  updateHubStandardSection,
  upsertSignupWizardStep,
} from '../lib/hubStandardCatalogApi';
import { hubStandardCatalogQueryKey } from '../lib/queryKeys';
import { FIELD_TYPES_WITH_OPTIONS, standardCatalogFieldKeyFromLabel } from '../lib/registrationFormTemplates';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

const colS = createColumnHelper();
const colF = createColumnHelper();
const colW = createColumnHelper();

function slugifyTitle(title) {
  return (
    String(title || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'secao'
  );
}

function parseOptionsTextarea(text) {
  return String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function optionsToTextarea(opts) {
  if (!Array.isArray(opts)) return '';
  return opts.map((x) => String(x)).join('\n');
}

/** @param {Record<string, unknown>} row @param {unknown[]} wizardSteps */
function inferSectionPartitionBucket(row, wizardSteps) {
  const stepSlug = String(row.wizard_step ?? '').trim();
  const slug = String(row.slug ?? '').trim();
  const list = Array.isArray(wizardSteps) ? wizardSteps : [];
  const hub = list.find((w) => String(w.slug) === stepSlug);
  if (hub?.partition_bucket === 'logistics') return 'logistics';
  if (hub?.partition_bucket === 'commercial') return 'commercial';
  const low = stepSlug.toLowerCase();
  if (low === 'logistics' || low === 'logistica') return 'logistics';
  if (low === 'commercial') return 'commercial';
  const hubBySec = list.find((w) => String(w.slug) === slug);
  if (hubBySec?.partition_bucket === 'logistics') return 'logistics';
  return 'commercial';
}

export function AdminStandardCatalogPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const supabase = useMemo(() => getSupabase(), []);
  const queryClient = useQueryClient();
  const { toast, alert, confirm } = useUiFeedback();
  const [busy, setBusy] = useState(false);

  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionIsNew, setSectionIsNew] = useState(true);
  const [sectionEditId, setSectionEditId] = useState(/** @type {string | null} */ (null));
  const [secTitle, setSecTitle] = useState('');
  const [secPartition, setSecPartition] = useState('commercial');
  const [secSort, setSecSort] = useState('0');
  const [secActive, setSecActive] = useState(true);
  const [secSlugReadonly, setSecSlugReadonly] = useState(/** @type {string | null} */ (null));

  const [fieldOpen, setFieldOpen] = useState(false);
  const [fieldIsNew, setFieldIsNew] = useState(true);
  const [fieldEditId, setFieldEditId] = useState(/** @type {string | null} */ (null));
  const [fldSectionId, setFldSectionId] = useState('');
  const [fldKey, setFldKey] = useState('');
  const [fldLabel, setFldLabel] = useState('');
  const [fldType, setFldType] = useState('text');
  const [fldRequired, setFldRequired] = useState(false);
  const [fldSort, setFldSort] = useState('0');
  const [fldPlaceholder, setFldPlaceholder] = useState('');
  const [fldRows, setFldRows] = useState('');
  const [fldOptions, setFldOptions] = useState('');
  const [fldActive, setFldActive] = useState(true);

  const listEnabled = Boolean(supabase && userId) && isSupabaseConfigured();
  const qk = hubStandardCatalogQueryKey('admin', userId);

  const { data: catalog = { sections: [], fields: [], wizardSteps: [] }, isLoading } = useQuery({
    queryKey: qk,
    queryFn: () => fetchHubStandardCatalogAdmin(supabase),
    enabled: listEnabled,
    retry: 1,
    staleTime: 10_000,
  });

  const sectionsSorted = useMemo(
    () => [...catalog.sections].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)),
    [catalog.sections]
  );

  const wizardStepsSorted = useMemo(
    () => [...(catalog.wizardSteps ?? [])].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)),
    [catalog.wizardSteps]
  );

  const publicWizardUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/#/cadastro/organizacao` : ''),
    []
  );

  const fieldsSorted = useMemo(
    () =>
      [...catalog.fields].sort((a, b) => {
        const sa = sectionsSorted.findIndex((x) => x.id === a.section_id);
        const sb = sectionsSorted.findIndex((x) => x.id === b.section_id);
        if (sa !== sb) return sa - sb;
        return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
      }),
    [catalog.fields, sectionsSorted]
  );

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['hub_standard_catalog'] });
  }, [queryClient]);

  const openNewSection = useCallback(() => {
    setSectionIsNew(true);
    setSectionEditId(null);
    setSecTitle('');
    setSecPartition('commercial');
    const maxOrder = sectionsSorted.reduce((m, s) => Math.max(m, Number(s.sort_order ?? 0)), -1);
    setSecSort(String(maxOrder + 1));
    setSecActive(true);
    setSecSlugReadonly(null);
    setSectionOpen(true);
  }, [sectionsSorted]);

  const openEditSection = useCallback(
    (row) => {
      setSectionIsNew(false);
      setSectionEditId(row.id);
      setSecTitle(row.title ?? '');
      setSecPartition(inferSectionPartitionBucket(row, catalog.wizardSteps ?? []));
      setSecSort(String(row.sort_order ?? 0));
      setSecActive(row.is_active !== false);
      setSecSlugReadonly(row.slug ?? null);
      setSectionOpen(true);
    },
    [catalog.wizardSteps]
  );

  const closeSection = useCallback(() => setSectionOpen(false), []);

  const saveSection = useCallback(async () => {
    if (!supabase) return;
    const title = secTitle.trim();
    if (!title) {
      await alert('Indique o título da seção.', { title: 'Catálogo' });
      return;
    }
    const secSlug = sectionIsNew ? slugifyTitle(title) : String(secSlugReadonly ?? '').trim();
    if (!secSlug) {
      await alert('Slug da seção em falta.', { title: 'Catálogo' });
      return;
    }
    const partition = secPartition === 'logistics' ? 'logistics' : 'commercial';
    setBusy(true);
    try {
      if (sectionIsNew) {
        await insertHubStandardSection(supabase, {
          slug: secSlug,
          title,
          sort_order: Number(secSort) || 0,
          wizard_step: secSlug,
          is_active: secActive,
        });
        toast('Seção criada.', { variant: 'success', duration: 4000 });
      } else if (sectionEditId) {
        await updateHubStandardSection(supabase, sectionEditId, {
          title,
          sort_order: Number(secSort) || 0,
          wizard_step: secSlug,
          is_active: secActive,
        });
        toast('Seção atualizada.', { variant: 'success', duration: 4000 });
      }
      await upsertSignupWizardStep(supabase, {
        slug: secSlug,
        label: title,
        partition_bucket: partition,
        sort_order: Number(secSort) || 0,
        is_active: secActive,
      });
      invalidate();
      closeSection();
    } catch (e) {
      await alert(String(e?.message || e || 'Falha ao salvar seção.'), { title: 'Erro' });
    } finally {
      setBusy(false);
    }
  }, [
    alert,
    closeSection,
    invalidate,
    secActive,
    secPartition,
    secSort,
    secSlugReadonly,
    secTitle,
    sectionEditId,
    sectionIsNew,
    supabase,
    toast,
  ]);

  const removeSection = useCallback(
    async (row) => {
      if (!supabase) return;
      const n = await countFieldsInSection(supabase, row.id);
      if (n > 0) {
        await alert(`Remova os ${n} campo(s) desta seção antes de a excluir.`, { title: 'Catálogo' });
        return;
      }
      const ok = await confirm(`Excluir a seção «${row.title}»?`, { title: 'Confirmar', danger: true });
      if (!ok) return;
      setBusy(true);
      try {
        await deleteHubStandardSection(supabase, row.id);
        try {
          await deleteSignupWizardStepBySlug(supabase, String(row.slug ?? ''));
        } catch (e2) {
          console.warn(e2);
        }
        invalidate();
        toast('Seção excluída.', { variant: 'success', duration: 4000 });
      } catch (e) {
        await alert(String(e?.message || e), { title: 'Erro' });
      } finally {
        setBusy(false);
      }
    },
    [alert, confirm, invalidate, supabase, toast]
  );

  const openNewField = useCallback(async () => {
    if (!sectionsSorted.length) {
      await alert('Crie primeiro uma seção.', { title: 'Catálogo' });
      return;
    }
    setFieldIsNew(true);
    setFieldEditId(null);
    setFldSectionId(sectionsSorted[0]?.id ?? '');
    setFldKey('');
    setFldLabel('');
    setFldType('text');
    setFldRequired(false);
    const sid = sectionsSorted[0]?.id;
    const maxF = catalog.fields.filter((f) => f.section_id === sid).reduce((m, f) => Math.max(m, Number(f.sort_order ?? 0)), -1);
    setFldSort(String(maxF + 1));
    setFldPlaceholder('');
    setFldRows('');
    setFldOptions('');
    setFldActive(true);
    setFieldOpen(true);
  }, [alert, catalog.fields, sectionsSorted]);

  const openEditField = useCallback((row) => {
    setFieldIsNew(false);
    setFieldEditId(row.id);
    setFldSectionId(row.section_id ?? '');
    setFldKey(row.field_key ?? '');
    setFldLabel(row.label ?? '');
    setFldType(row.field_type ?? 'text');
    setFldRequired(row.required === true);
    setFldSort(String(row.sort_order ?? 0));
    setFldPlaceholder(row.placeholder ?? '');
    setFldRows(row.rows != null ? String(row.rows) : '');
    setFldOptions(optionsToTextarea(row.options));
    setFldActive(row.is_active !== false);
    setFieldOpen(true);
  }, []);

  const closeField = useCallback(() => setFieldOpen(false), []);

  const saveField = useCallback(async () => {
    if (!supabase) return;
    const sid = fldSectionId;
    if (!sid) {
      await alert('Selecione a seção.', { title: 'Catálogo' });
      return;
    }
    const label = fldLabel.trim();
    if (!label) {
      await alert('Indique o rótulo.', { title: 'Catálogo' });
      return;
    }
    const catalogForKeys = { sections: catalog.sections, fields: catalog.fields };
    const key = fieldIsNew
      ? standardCatalogFieldKeyFromLabel(label, sid, catalogForKeys, null)
      : fldKey
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .slice(0, 80);
    if (!fieldIsNew && !key) {
      await alert('Chave técnica em falta.', { title: 'Catálogo' });
      return;
    }
    const options = FIELD_TYPES_WITH_OPTIONS.includes(fldType) ? parseOptionsTextarea(fldOptions) : [];
    if (FIELD_TYPES_WITH_OPTIONS.includes(fldType) && options.length === 0) {
      await alert('Preencha pelo menos uma opção (uma por linha).', { title: 'Catálogo' });
      return;
    }
    setBusy(true);
    try {
      if (fieldIsNew) {
        await insertHubStandardField(supabase, {
          section_id: sid,
          field_key: key,
          label,
          field_type: fldType,
          required: fldRequired,
          options,
          placeholder: fldPlaceholder.trim() || null,
          rows: fldRows.trim() ? Number(fldRows) : null,
          sort_order: Number(fldSort) || 0,
          is_active: fldActive,
          extra: {},
        });
        toast('Campo criado.', { variant: 'success', duration: 4000 });
      } else if (fieldEditId) {
        await updateHubStandardField(supabase, fieldEditId, {
          section_id: sid,
          label,
          field_type: fldType,
          required: fldRequired,
          options,
          placeholder: fldPlaceholder.trim() || null,
          rows: fldRows.trim() ? Number(fldRows) : null,
          sort_order: Number(fldSort) || 0,
          is_active: fldActive,
        });
        toast('Campo atualizado.', { variant: 'success', duration: 4000 });
      }
      invalidate();
      closeField();
    } catch (e) {
      await alert(String(e?.message || e || 'Falha ao salvar campo.'), { title: 'Erro' });
    } finally {
      setBusy(false);
    }
  }, [
    alert,
    closeField,
    fieldEditId,
    fieldIsNew,
    fldActive,
    fldLabel,
    fldKey,
    catalog,
    fldOptions,
    fldPlaceholder,
    fldRequired,
    fldRows,
    fldSectionId,
    fldSort,
    fldType,
    invalidate,
    supabase,
    toast,
  ]);

  const removeField = useCallback(
    async (row) => {
      if (!supabase) return;
      const ok = await confirm(`Excluir o campo «${row.label}»?`, { title: 'Confirmar', danger: true });
      if (!ok) return;
      setBusy(true);
      try {
        await deleteHubStandardField(supabase, row.id);
        invalidate();
        toast('Campo excluído.', { variant: 'success', duration: 4000 });
      } catch (e) {
        await alert(String(e?.message || e), { title: 'Erro' });
      } finally {
        setBusy(false);
      }
    },
    [alert, confirm, invalidate, supabase, toast]
  );

  const sectionColumns = useMemo(
    () => [
      colS.accessor('title', {
        header: 'Seção',
        cell: (info) => <span className="font-semibold text-primary">{info.getValue() || '—'}</span>,
      }),
      colS.accessor('slug', {
        header: 'Slug',
        cell: (info) => <span className="font-mono text-xs text-on-surface-variant">{info.getValue()}</span>,
      }),
      colS.display({
        id: 'publico',
        header: 'No cadastro público',
        cell: (info) => {
          const row = info.row.original;
          const step =
            wizardStepsSorted.find((w) => String(w.slug) === String(row.wizard_step)) ||
            wizardStepsSorted.find((w) => String(w.slug) === String(row.slug));
          const partLabel = step?.partition_bucket === 'logistics' ? 'Logística e doca' : 'Informações comerciais';
          return (
            <span className="text-sm text-on-surface-variant" title={step?.label ? String(step.label) : undefined}>
              {partLabel}
            </span>
          );
        },
      }),
      colS.accessor('sort_order', {
        header: 'Ordem',
        cell: (info) => <span className="font-mono text-xs">{info.getValue() ?? '—'}</span>,
      }),
      colS.accessor('is_active', {
        header: 'Estado',
        cell: (info) => (
          <span
            className={`text-[10px] font-black uppercase tracking-wide ${
              info.getValue() === false ? 'text-amber-800' : 'text-emerald-800'
            }`}
          >
            {info.getValue() === false ? 'Inativo' : 'Ativo'}
          </span>
        ),
      }),
      colS.display({
        id: 'actions',
        header: '',
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <HubButton
                variant="tableSecondary"
                icon="edit"
                iconClassName="text-[16px]"
                disabled={busy}
                onClick={() => openEditSection(row)}
              >
                Editar
              </HubButton>
              <HubButton
                variant="danger"
                icon="delete"
                iconClassName="text-[16px]"
                disabled={busy}
                onClick={() => void removeSection(row)}
              >
                Excluir
              </HubButton>
            </div>
          );
        },
      }),
    ],
    [busy, openEditSection, removeSection, wizardStepsSorted]
  );

  const wizardStepsSummary = useMemo(
    () =>
      wizardStepsSorted.filter((w) => sectionsSorted.some((s) => String(s.slug) === String(w.slug))),
    [wizardStepsSorted, sectionsSorted]
  );

  const wstepSummaryColumns = useMemo(
    () => [
      colW.accessor('label', {
        header: 'Rótulo (seção)',
        cell: (info) => <span className="font-semibold text-primary">{info.getValue() || '—'}</span>,
      }),
      colW.accessor('slug', {
        header: 'Slug',
        cell: (info) => <span className="font-mono text-xs text-on-surface-variant">{info.getValue()}</span>,
      }),
      colW.accessor('partition_bucket', {
        header: 'Bloco no cadastro',
        cell: (info) => (
          <span className="text-sm text-on-surface-variant">
            {info.getValue() === 'logistics' ? 'Logística e doca' : 'Informações comerciais'}
          </span>
        ),
      }),
      colW.accessor('sort_order', {
        header: 'Ordem',
        cell: (info) => <span className="font-mono text-xs">{info.getValue() ?? '—'}</span>,
      }),
      colW.accessor('is_active', {
        header: 'Estado',
        cell: (info) => (
          <span
            className={`text-[10px] font-black uppercase tracking-wide ${
              info.getValue() === false ? 'text-amber-800' : 'text-emerald-800'
            }`}
          >
            {info.getValue() === false ? 'Inativo' : 'Ativo'}
          </span>
        ),
      }),
    ],
    []
  );

  const fieldColumns = useMemo(
    () => [
      colF.accessor('label', {
        header: 'Rótulo',
        cell: (info) => <span className="font-semibold text-slate-900">{info.getValue() || '—'}</span>,
      }),
      colF.accessor('field_key', {
        header: 'Chave',
        cell: (info) => <span className="font-mono text-xs text-on-surface-variant">{info.getValue()}</span>,
      }),
      colF.accessor('field_type', {
        header: 'Tipo',
        cell: (info) => <span className="text-sm text-on-surface-variant">{info.getValue()}</span>,
      }),
      colF.display({
        id: 'section',
        header: 'Seção',
        cell: (info) => {
          const sid = info.row.original.section_id;
          const sec = catalog.sections.find((s) => s.id === sid);
          return <span className="text-sm text-on-surface-variant">{sec?.title ?? '—'}</span>;
        },
      }),
      colF.accessor('sort_order', {
        header: 'Ordem',
        cell: (info) => <span className="font-mono text-xs">{info.getValue() ?? '—'}</span>,
      }),
      colF.accessor('is_active', {
        header: 'Estado',
        cell: (info) => (
          <span
            className={`text-[10px] font-black uppercase tracking-wide ${
              info.getValue() === false ? 'text-amber-800' : 'text-emerald-800'
            }`}
          >
            {info.getValue() === false ? 'Inativo' : 'Ativo'}
          </span>
        ),
      }),
      colF.display({
        id: 'facts',
        header: '',
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <HubButton
                variant="tableSecondary"
                icon="edit"
                iconClassName="text-[16px]"
                disabled={busy}
                onClick={() => openEditField(row)}
              >
                Editar
              </HubButton>
              <HubButton
                variant="danger"
                icon="delete"
                iconClassName="text-[16px]"
                disabled={busy}
                onClick={() => void removeField(row)}
              >
                Excluir
              </HubButton>
            </div>
          );
        },
      }),
    ],
    [busy, catalog.sections, openEditField, removeField]
  );

  const secSlugPreview = sectionIsNew ? slugifyTitle(secTitle || 'exemplo') : null;

  if (!isSupabaseConfigured() || !supabase) {
    return (
      <div className="max-w-xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Ligação ao servidor indisponível.
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-none space-y-8">
      <section className="w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-600">Seções (blocos)</h2>
          <HubButton variant="primary" icon="add" disabled={busy || isLoading} onClick={openNewSection}>
            Nova seção
          </HubButton>
        </div>
        <div className="p-4 sm:p-5">
          {isLoading ? (
            <p className="text-sm text-on-surface-variant">Carregando…</p>
          ) : (
            <EntityDataTable
              data={sectionsSorted}
              columns={sectionColumns}
              getRowId={(r) => r.id}
              searchPlaceholder="Pesquisar seções…"
              emptyLabel="Nenhuma seção"
              pageSize={12}
            />
          )}
        </div>
      </section>

      <section className="w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-600">
            Resumo: etapas no cadastro público
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-on-surface-variant">
            Gerado automaticamente ao salvar uma seção (rótulo, slug e bloco comercial vs. logística). Não é preciso criar etapas
            manualmente.
          </p>
        </div>
        <div className="p-4 sm:p-5">
          {isLoading ? (
            <p className="text-sm text-on-surface-variant">Carregando…</p>
          ) : (
            <EntityDataTable
              data={wizardStepsSummary}
              columns={wstepSummaryColumns}
              getRowId={(r) => r.id}
              searchPlaceholder="Buscar…"
              emptyLabel="Crie uma seção para ver o resumo das etapas"
              pageSize={12}
            />
          )}
        </div>
      </section>

      <section className="w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-600">Campos do catálogo</h2>
          <HubButton
            variant="secondaryDashed"
            icon="add_circle"
            disabled={busy || isLoading || sectionsSorted.length === 0}
            onClick={() => void openNewField()}
          >
            Adicionar campo
          </HubButton>
        </div>
        <div className="p-4 sm:p-5">
          {isLoading ? (
            <p className="text-sm text-on-surface-variant">Carregando…</p>
          ) : (
            <EntityDataTable
              data={fieldsSorted}
              columns={fieldColumns}
              getRowId={(r) => r.id}
              searchPlaceholder="Pesquisar campos…"
              emptyLabel="Nenhum campo"
              pageSize={12}
            />
          )}
        </div>
      </section>

      <StandardCatalogSectionSideover
        open={sectionOpen}
        onClose={closeSection}
        isNew={sectionIsNew}
        title={secTitle}
        setTitle={setSecTitle}
        partitionBucket={secPartition}
        setPartitionBucket={setSecPartition}
        publicWizardUrl={publicWizardUrl}
        sortOrder={secSort}
        setSortOrder={setSecSort}
        isActive={secActive}
        setIsActive={setSecActive}
        slugPreview={secSlugPreview}
        slugReadonly={sectionIsNew ? null : secSlugReadonly}
        onSave={saveSection}
        busy={busy}
      />

      <StandardCatalogFieldSideover
        open={fieldOpen}
        onClose={closeField}
        isNew={fieldIsNew}
        sectionId={fldSectionId}
        setSectionId={setFldSectionId}
        sections={sectionsSorted}
        fieldKey={fldKey}
        setFieldKey={setFldKey}
        keyReadonly={!fieldIsNew}
        catalogForKeyPreview={{ sections: catalog.sections, fields: catalog.fields }}
        label={fldLabel}
        setLabel={setFldLabel}
        fieldType={fldType}
        setFieldType={setFldType}
        required={fldRequired}
        setRequired={setFldRequired}
        sortOrder={fldSort}
        setSortOrder={setFldSort}
        placeholder={fldPlaceholder}
        setPlaceholder={setFldPlaceholder}
        rows={fldRows}
        setRows={setFldRows}
        optionsText={fldOptions}
        setOptionsText={setFldOptions}
        isActive={fldActive}
        setIsActive={setFldActive}
        onSave={saveField}
        busy={busy}
      />
    </div>
  );
}

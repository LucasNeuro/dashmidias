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
  updateSignupWizardStep,
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

/** Persistido em `hub_signup_wizard_step.partition_bucket` por compatibilidade — o cadastro público usa uma etapa por grupo. */
function partitionBucketFromSectionSlug(slug) {
  const s = String(slug ?? '').trim().toLowerCase();
  return s === 'logistica' || s === 'logistics' ? 'logistics' : 'commercial';
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
      setSecSort(String(row.sort_order ?? 0));
      setSecActive(row.is_active !== false);
      setSecSlugReadonly(row.slug ?? null);
      setSectionOpen(true);
    },
    []
  );

  const closeSection = useCallback(() => setSectionOpen(false), []);

  const saveSection = useCallback(async () => {
    if (!supabase) return;
    const title = secTitle.trim();
    if (!title) {
      await alert('Indique o nome do grupo.', { title: 'Campos' });
      return;
    }
    const secSlug = sectionIsNew ? slugifyTitle(title) : String(secSlugReadonly ?? '').trim();
    if (!secSlug) {
      await alert('Identificador do grupo em falta.', { title: 'Campos' });
      return;
    }
    const partition = partitionBucketFromSectionSlug(secSlug);
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
        toast('Grupo criado.', { variant: 'success', duration: 4000 });
      } else if (sectionEditId) {
        await updateHubStandardSection(supabase, sectionEditId, {
          title,
          sort_order: Number(secSort) || 0,
          wizard_step: secSlug,
          is_active: secActive,
        });
        toast('Grupo atualizado.', { variant: 'success', duration: 4000 });
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
        await alert(`Remova os ${n} campo(s) deste grupo antes de o excluir.`, { title: 'Campos' });
        return;
      }
      const ok = await confirm(`Excluir o grupo «${row.title}»?`, { title: 'Confirmar', danger: true });
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
        toast('Grupo excluído.', { variant: 'success', duration: 4000 });
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
      await alert('Crie primeiro um grupo de campos.', { title: 'Campos' });
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
      await alert('Seleccione o grupo.', { title: 'Campos' });
      return;
    }
    const label = fldLabel.trim();
    if (!label) {
      await alert('Indique o nome do campo.', { title: 'Campos' });
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
      await alert('Código do campo em falta.', { title: 'Campos' });
      return;
    }
    const options = FIELD_TYPES_WITH_OPTIONS.includes(fldType) ? parseOptionsTextarea(fldOptions) : [];
    if (FIELD_TYPES_WITH_OPTIONS.includes(fldType) && options.length === 0) {
      await alert('Preencha pelo menos uma opção (uma por linha).', { title: 'Campos' });
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

  const syncWizardStepFromSectionRow = useCallback(
    async (sectionRow, sortOrder) => {
      if (!supabase) return;
      const slug = String(sectionRow.slug ?? '').trim();
      if (!slug) return;
      const partition = partitionBucketFromSectionSlug(slug);
      await upsertSignupWizardStep(supabase, {
        slug,
        label: String(sectionRow.title ?? slug).trim() || slug,
        partition_bucket: partition,
        sort_order: sortOrder,
        is_active: sectionRow.is_active !== false,
      });
    },
    [supabase]
  );

  const toggleSectionActive = useCallback(
    async (row) => {
      if (!supabase) return;
      const next = row.is_active === false;
      setBusy(true);
      try {
        await updateHubStandardSection(supabase, row.id, { is_active: next });
        await syncWizardStepFromSectionRow({ ...row, is_active: next }, Number(row.sort_order ?? 0));
        invalidate();
        toast(next ? 'Grupo ativado.' : 'Grupo desativado (deixa de aparecer no cadastro público).', {
          variant: 'success',
          duration: 4500,
        });
      } catch (e) {
        await alert(String(e?.message || e), { title: 'Erro' });
      } finally {
        setBusy(false);
      }
    },
    [alert, invalidate, supabase, syncWizardStepFromSectionRow, toast]
  );

  const moveSection = useCallback(
    async (row, delta) => {
      if (!supabase) return;
      const idx = sectionsSorted.findIndex((s) => s.id === row.id);
      const j = idx + delta;
      if (idx < 0 || j < 0 || j >= sectionsSorted.length) return;
      const a = sectionsSorted[idx];
      const b = sectionsSorted[j];
      const oa = Number(a.sort_order ?? 0);
      const ob = Number(b.sort_order ?? 0);
      setBusy(true);
      try {
        await updateHubStandardSection(supabase, a.id, { sort_order: ob });
        await updateHubStandardSection(supabase, b.id, { sort_order: oa });
        await syncWizardStepFromSectionRow({ ...a, sort_order: ob }, ob);
        await syncWizardStepFromSectionRow({ ...b, sort_order: oa }, oa);
        invalidate();
        toast('Ordem dos grupos atualizada.', { variant: 'success', duration: 3500 });
      } catch (e) {
        await alert(String(e?.message || e), { title: 'Erro' });
      } finally {
        setBusy(false);
      }
    },
    [alert, invalidate, sectionsSorted, supabase, syncWizardStepFromSectionRow, toast]
  );

  const toggleFieldActive = useCallback(
    async (row) => {
      if (!supabase) return;
      const next = row.is_active === false;
      setBusy(true);
      try {
        await updateHubStandardField(supabase, row.id, { is_active: next });
        invalidate();
        toast(next ? 'Campo ativado.' : 'Campo desativado.', { variant: 'success', duration: 3500 });
      } catch (e) {
        await alert(String(e?.message || e), { title: 'Erro' });
      } finally {
        setBusy(false);
      }
    },
    [alert, invalidate, supabase, toast]
  );

  const moveField = useCallback(
    async (row, delta) => {
      if (!supabase) return;
      const sid = row.section_id;
      const inSec = fieldsSorted.filter((f) => f.section_id === sid);
      const byOrder = [...inSec].sort((x, y) => Number(x.sort_order ?? 0) - Number(y.sort_order ?? 0));
      const idx = byOrder.findIndex((f) => f.id === row.id);
      const j = idx + delta;
      if (idx < 0 || j < 0 || j >= byOrder.length) return;
      const a = byOrder[idx];
      const b = byOrder[j];
      const oa = Number(a.sort_order ?? 0);
      const ob = Number(b.sort_order ?? 0);
      setBusy(true);
      try {
        await updateHubStandardField(supabase, a.id, { sort_order: ob });
        await updateHubStandardField(supabase, b.id, { sort_order: oa });
        invalidate();
        toast('Ordem dos campos atualizada.', { variant: 'success', duration: 3500 });
      } catch (e) {
        await alert(String(e?.message || e), { title: 'Erro' });
      } finally {
        setBusy(false);
      }
    },
    [alert, fieldsSorted, invalidate, supabase, toast]
  );

  const sectionColumns = useMemo(
    () => [
      colS.accessor('title', {
        header: 'Grupo',
        cell: (info) => <span className="font-semibold text-primary">{info.getValue() || '—'}</span>,
      }),
      colS.accessor('slug', {
        header: 'Código',
        cell: (info) => <span className="font-mono text-xs text-on-surface-variant">{info.getValue()}</span>,
      }),
      colS.display({
        id: 'publico',
        header: 'Nome no cadastro público',
        cell: (info) => {
          const row = info.row.original;
          const step =
            wizardStepsSorted.find((w) => String(w.slug) === String(row.wizard_step)) ||
            wizardStepsSorted.find((w) => String(w.slug) === String(row.slug));
          return <span className="text-sm text-on-surface-variant">{step?.label ? String(step.label) : '—'}</span>;
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
            {info.getValue() === false ? 'Desligado' : 'Ligado'}
          </span>
        ),
      }),
      colS.display({
        id: 'actions',
        header: '',
        cell: (info) => {
          const row = info.row.original;
          const idx = sectionsSorted.findIndex((s) => s.id === row.id);
          const atTop = idx <= 0;
          const atBottom = idx < 0 || idx >= sectionsSorted.length - 1;
          return (
            <div className="flex min-w-max shrink-0 flex-nowrap items-center justify-end gap-1">
              <HubButton
                variant="tableSecondary"
                icon="arrow_upward"
                iconClassName="text-[16px]"
                disabled={busy || atTop}
                title="Mover grupo para cima"
                onClick={() => void moveSection(row, -1)}
                className="!px-2"
              >
                <span className="sr-only">Subir</span>
              </HubButton>
              <HubButton
                variant="tableSecondary"
                icon="arrow_downward"
                iconClassName="text-[16px]"
                disabled={busy || atBottom}
                title="Mover grupo para baixo"
                onClick={() => void moveSection(row, 1)}
                className="!px-2"
              >
                <span className="sr-only">Descer</span>
              </HubButton>
              <HubButton
                variant="tableSecondary"
                icon={row.is_active === false ? 'toggle_on' : 'toggle_off'}
                iconClassName="text-[16px]"
                disabled={busy}
                title={row.is_active === false ? 'Ligar grupo no cadastro público' : 'Desligar sem apagar'}
                onClick={() => void toggleSectionActive(row)}
              >
                {row.is_active === false ? 'Ligar' : 'Desligar'}
              </HubButton>
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
                title="Excluir grupo"
                onClick={() => void removeSection(row)}
                className="!px-2"
              >
                <span className="sr-only">Excluir</span>
              </HubButton>
            </div>
          );
        },
      }),
    ],
    [busy, moveSection, openEditSection, removeSection, sectionsSorted, toggleSectionActive, wizardStepsSorted]
  );

  const wizardStepsSummary = useMemo(
    () =>
      wizardStepsSorted.filter((w) => sectionsSorted.some((s) => String(s.slug) === String(w.slug))),
    [wizardStepsSorted, sectionsSorted]
  );

  const wizardStepsSummaryOrdered = useMemo(
    () =>
      [...wizardStepsSummary].sort(
        (a, b) =>
          Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || String(a.slug ?? '').localeCompare(String(b.slug ?? ''))
      ),
    [wizardStepsSummary]
  );

  const openEditFromWizardRow = useCallback(
    async (wrow) => {
      const sec = sectionsSorted.find((s) => String(s.slug) === String(wrow.slug));
      if (!sec) {
        await alert('Não há grupo com este código — crie ou edite o grupo na primeira tabela.', { title: 'Campos' });
        return;
      }
      openEditSection(sec);
    },
    [alert, openEditSection, sectionsSorted]
  );

  const toggleWizardStepRow = useCallback(
    async (wrow) => {
      const sec = sectionsSorted.find((s) => String(s.slug) === String(wrow.slug));
      if (!sec) {
        await alert('Grupo não encontrado para esta etapa.', { title: 'Campos' });
        return;
      }
      await toggleSectionActive(sec);
    },
    [alert, sectionsSorted, toggleSectionActive]
  );

  const moveWizardStep = useCallback(
    async (wrow, delta) => {
      if (!supabase) return;
      const list = wizardStepsSummaryOrdered;
      const idx = list.findIndex((w) => w.id === wrow.id);
      const j = idx + delta;
      if (idx < 0 || j < 0 || j >= list.length) return;
      const wa = list[idx];
      const wb = list[j];
      const oa = Number(wa.sort_order ?? 0);
      const ob = Number(wb.sort_order ?? 0);
      const secA = sectionsSorted.find((s) => String(s.slug) === String(wa.slug));
      const secB = sectionsSorted.find((s) => String(s.slug) === String(wb.slug));
      if (!secA?.id || !secB?.id) {
        await alert('Não foi possível alinhar esta etapa a um grupo.', { title: 'Campos' });
        return;
      }
      setBusy(true);
      try {
        await updateSignupWizardStep(supabase, wa.id, { sort_order: ob });
        await updateSignupWizardStep(supabase, wb.id, { sort_order: oa });
        await updateHubStandardSection(supabase, secA.id, { sort_order: ob });
        await updateHubStandardSection(supabase, secB.id, { sort_order: oa });
        invalidate();
        toast('Ordem das etapas e dos grupos actualizada.', { variant: 'success', duration: 3500 });
      } catch (e) {
        await alert(String(e?.message || e), { title: 'Erro' });
      } finally {
        setBusy(false);
      }
    },
    [alert, invalidate, sectionsSorted, supabase, toast, wizardStepsSummaryOrdered]
  );

  const wstepSummaryColumns = useMemo(
    () => [
      colW.accessor('label', {
        header: 'Nome da etapa',
        cell: (info) => <span className="font-semibold text-primary">{info.getValue() || '—'}</span>,
      }),
      colW.accessor('slug', {
        header: 'Código',
        cell: (info) => <span className="font-mono text-xs text-on-surface-variant">{info.getValue()}</span>,
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
            {info.getValue() === false ? 'Desligado' : 'Ligado'}
          </span>
        ),
      }),
      colW.display({
        id: 'wactions',
        header: '',
        cell: (info) => {
          const row = info.row.original;
          const idx = wizardStepsSummaryOrdered.findIndex((w) => w.id === row.id);
          const atTop = idx <= 0;
          const atBottom = idx < 0 || idx >= wizardStepsSummaryOrdered.length - 1;
          return (
            <div className="flex min-w-max shrink-0 flex-nowrap items-center justify-end gap-1">
              <HubButton
                variant="tableSecondary"
                icon="arrow_upward"
                iconClassName="text-[16px]"
                disabled={busy || atTop}
                title="Mover etapa para cima"
                onClick={() => void moveWizardStep(row, -1)}
                className="!px-2"
              >
                <span className="sr-only">Subir</span>
              </HubButton>
              <HubButton
                variant="tableSecondary"
                icon="arrow_downward"
                iconClassName="text-[16px]"
                disabled={busy || atBottom}
                title="Mover etapa para baixo"
                onClick={() => void moveWizardStep(row, 1)}
                className="!px-2"
              >
                <span className="sr-only">Descer</span>
              </HubButton>
              <HubButton
                variant="tableSecondary"
                icon={row.is_active === false ? 'toggle_on' : 'toggle_off'}
                iconClassName="text-[16px]"
                disabled={busy}
                title={row.is_active === false ? 'Ligar etapa e grupo' : 'Desligar etapa e grupo'}
                onClick={() => void toggleWizardStepRow(row)}
              >
                {row.is_active === false ? 'Ligar' : 'Desligar'}
              </HubButton>
              <HubButton
                variant="tableSecondary"
                icon="edit"
                iconClassName="text-[16px]"
                disabled={busy}
                title="Editar nome e ordem da etapa"
                onClick={() => void openEditFromWizardRow(row)}
              >
                Editar
              </HubButton>
            </div>
          );
        },
      }),
    ],
    [busy, moveWizardStep, openEditFromWizardRow, toggleWizardStepRow, wizardStepsSummaryOrdered]
  );

  const fieldColumns = useMemo(
    () => [
      colF.accessor('label', {
        header: 'Campo',
        cell: (info) => <span className="font-semibold text-slate-900">{info.getValue() || '—'}</span>,
      }),
      colF.accessor('field_key', {
        header: 'Código',
        cell: (info) => <span className="font-mono text-xs text-on-surface-variant">{info.getValue()}</span>,
      }),
      colF.accessor('field_type', {
        header: 'Tipo',
        cell: (info) => <span className="text-sm text-on-surface-variant">{info.getValue()}</span>,
      }),
      colF.display({
        id: 'section',
        header: 'Grupo',
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
            {info.getValue() === false ? 'Desligado' : 'Ligado'}
          </span>
        ),
      }),
      colF.display({
        id: 'facts',
        header: '',
        cell: (info) => {
          const row = info.row.original;
          const sid = row.section_id;
          const inSec = fieldsSorted.filter((f) => f.section_id === sid);
          const byOrder = [...inSec].sort((x, y) => Number(x.sort_order ?? 0) - Number(y.sort_order ?? 0));
          const fIdx = byOrder.findIndex((f) => f.id === row.id);
          const atTop = fIdx <= 0;
          const atBottom = fIdx < 0 || fIdx >= byOrder.length - 1;
          return (
            <div className="flex min-w-max shrink-0 flex-nowrap items-center justify-end gap-1">
              <HubButton
                variant="tableSecondary"
                icon="arrow_upward"
                iconClassName="text-[16px]"
                disabled={busy || atTop}
                title="Mover campo para cima neste grupo"
                onClick={() => void moveField(row, -1)}
                className="!px-2"
              >
                <span className="sr-only">Subir</span>
              </HubButton>
              <HubButton
                variant="tableSecondary"
                icon="arrow_downward"
                iconClassName="text-[16px]"
                disabled={busy || atBottom}
                title="Mover campo para baixo neste grupo"
                onClick={() => void moveField(row, 1)}
                className="!px-2"
              >
                <span className="sr-only">Descer</span>
              </HubButton>
              <HubButton
                variant="tableSecondary"
                icon={row.is_active === false ? 'toggle_on' : 'toggle_off'}
                iconClassName="text-[16px]"
                disabled={busy}
                title={row.is_active === false ? 'Ligar campo' : 'Desligar campo sem apagar'}
                onClick={() => void toggleFieldActive(row)}
              >
                {row.is_active === false ? 'Ligar' : 'Desligar'}
              </HubButton>
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
                title="Excluir campo"
                onClick={() => void removeField(row)}
                className="!px-2"
              >
                <span className="sr-only">Excluir</span>
              </HubButton>
            </div>
          );
        },
      }),
    ],
    [busy, catalog.sections, fieldsSorted, moveField, openEditField, removeField, toggleFieldActive]
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
      <header className="space-y-1.5">
        <h1 className="text-sm font-black uppercase tracking-[0.18em] text-primary">Campos</h1>
        <p className="max-w-3xl text-xs leading-relaxed text-slate-600">
          Monte <strong>grupos</strong> de campos e os <strong>campos</strong> reutilizáveis nos modelos. Cada grupo vira uma{' '}
          <strong>etapa sua</strong> no cadastro público, na ordem que definir. Use <strong>Ligar / Desligar</strong> para esconder algo
          sem apagar, e as setas para mudar a ordem.
        </p>
      </header>

      <section className="w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-600">Grupos de campos</h2>
          <HubButton variant="primary" icon="add" disabled={busy || isLoading} onClick={openNewSection}>
            Novo grupo
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
              searchPlaceholder="Pesquisar grupos…"
              emptyLabel="Nenhum grupo — crie o primeiro acima"
              pageSize={12}
            />
          )}
        </div>
      </section>

      <section className="w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-600">
            Etapas no cadastro público
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-on-surface-variant">
            Cada linha é a etapa pública ligada a um <strong>grupo</strong>. Pode <strong>subir/descer</strong>, <strong>ligar ou desligar</strong>{' '}
            (atualiza grupo e etapa) e <strong>editar</strong> (nome e ordem — mesmo painel do grupo).
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
              emptyLabel="Crie um grupo para ver as etapas aqui"
              pageSize={12}
            />
          )}
        </div>
      </section>

      <section className="w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-600">Campos</h2>
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

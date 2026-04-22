import { useCallback, useEffect, useState } from 'react';
import { AppSideover } from '../AppSideover';
import { getHubPartnerKind, normalizePartnerKindSlug } from '../../lib/hubPartnerKinds';
import { inviteUrlForTemplate } from '../../lib/registrationFormTemplates';
import { buildMailtoInvite, sendTemplateInviteEmail } from '../../lib/sendTemplateInviteEmail';
import { useUiFeedback } from '../../context/UiFeedbackContext';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {object} p
 * @param {boolean} p.open
 * @param {() => void} p.onClose
 * @param {import('../../lib/registrationFormTemplates').RegistrationFormTemplate | null} p.row
 */
export function ShareTemplateSideover({ open, onClose, row }) {
  const { toast, alert, confirm } = useUiFeedback();
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setTo('');
      setNote('');
      setSending(false);
    }
  }, [open, row?.id]);

  const kindLabel = row ? getHubPartnerKind(normalizePartnerKindSlug(row.partnerKind))?.label : '';
  const templateName = row?.name?.trim() || '—';
  const inviteUrl = row?.id ? inviteUrlForTemplate(row.id) : '';
  const invitePaused = row?.inviteLinkEnabled === false;

  const onSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (!row?.id) return;
      if (invitePaused) {
        await alert('Ative o convite por link na edição do template antes de enviar por e-mail.', {
          title: 'Convite pausado',
        });
        return;
      }
      const addr = to.trim();
      if (!addr || !emailRe.test(addr)) {
        await alert('Informe um e-mail válido do destinatário.', { title: 'E-mail' });
        return;
      }
      if (!inviteUrl) {
        await alert('Não foi possível montar o link de convite.', { title: 'Link' });
        return;
      }
      setSending(true);
      try {
        const r = await sendTemplateInviteEmail({
          to: addr,
          templateName: templateName,
          inviteUrl,
          kindLabel: kindLabel || undefined,
          note: note.trim() || undefined,
        });
        if (r.ok) {
          toast('Convite enviado por e-mail.', { variant: 'success' });
          onClose();
          return;
        }
        setSending(false);
        const mailto = buildMailtoInvite({
          to: addr,
          templateName: templateName,
          inviteUrl,
          kindLabel: kindLabel || undefined,
          note: note.trim() || undefined,
        });
        const useMailto = await confirm(
          `${r.message}\n\nQuer abrir o programa de e-mail padrão com o assunto e a mensagem do convite preenchidos?`,
          { title: 'Enviar convite' }
        );
        if (useMailto) window.location.href = mailto;
      } finally {
        setSending(false);
      }
    },
    [alert, confirm, invitePaused, inviteUrl, kindLabel, note, onClose, row?.id, templateName, toast, to]
  );

  if (!row) return null;

  return (
    <AppSideover
      open={open}
      onClose={onClose}
      title="Compartilhar convite"
      subtitle="A pessoa indicada recebe o link do cadastro no e-mail — pode acrescentar uma nota (opcional)."
      variant="governance"
      bodyClassName="p-0"
    >
      <form onSubmit={onSubmit} className="flex h-full min-h-0 flex-col p-4 sm:p-5">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-800">Template:</span> {templateName}
            </p>
            {kindLabel ? (
              <p className="mt-1">
                <span className="font-semibold text-slate-800">Perfil:</span> {kindLabel}
              </p>
            ) : null}
          </div>

          {invitePaused ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              O convite por link está desativado para este template. Ative em Editar.
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              E-mail do destinatário *
            </span>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="contato@empresa.com.br"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mensagem opcional</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Ex.: Preencha com o CNPJ da imobiliária."
            />
          </label>

        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/90 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-primary hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={sending || invitePaused}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm hover:bg-[#0f2840] disabled:opacity-50"
          >
            {sending ? 'Enviando…' : 'Enviar e-mail'}
          </button>
        </div>
      </form>
    </AppSideover>
  );
}

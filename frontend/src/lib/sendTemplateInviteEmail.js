import { getSupabase, isSupabaseConfigured } from './supabaseClient';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{ to: string, templateName: string, inviteUrl: string, kindLabel?: string, note?: string }} p
 * @returns {Promise<{ ok: true } | { ok: false, code: string, message: string, mailtoHref?: string }>}
 */
export async function sendTemplateInviteEmail({ to, templateName, inviteUrl, kindLabel, note }) {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'supabase',
      message:
        'O envio online não está disponível neste ambiente. Use o botão “Link” e envie o endereço por outro canal.',
    };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, code: 'supabase', message: 'Não foi possível ligar ao serviço. Tente de novo em instantes.' };
  }

  const name = (templateName || 'Cadastro').trim();
  const kind = (kindLabel || '').trim();
  const subject = `Convite Obra10+ — ${name}`;
  const noteBlock =
    note && String(note).trim()
      ? `<p style="margin:12px 0 0 0"><strong>Sua nota do remetente:</strong><br/>${escapeHtml(String(note).trim()).replace(/\n/g, '<br/>')}</p>`
      : '';
  const kindLine = kind ? `<p><strong>Perfil:</strong> ${escapeHtml(kind)}</p>` : '';

  const html = `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;font-size:15px;color:#0f172a;line-height:1.5">
  <p>Olá,</p>
  <p>Você foi convidado a completar o cadastro no <strong>Obra10+</strong>.</p>
  <p><strong>${escapeHtml(name)}</strong></p>
  ${kindLine}
  ${noteBlock}
  <p><a href="${escapeHtml(inviteUrl)}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#0b2a44;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Abrir formulário de cadastro</a></p>
  <p style="margin-top:20px;font-size:13px;color:#64748b">Se o botão não abrir, copie e cole o link no navegador:<br/><span style="word-break:break-all">${escapeHtml(
    inviteUrl
  )}</span></p>
</body></html>`;

  const { data, error } = await supabase.functions.invoke('send-template-invite', {
    body: { to: to.trim(), subject, html, templateName: name },
  });

  if (error) {
    let detail = '';
    try {
      const ctx = /** @type {{ json?: () => Promise<unknown> }} */ (error).context;
      if (ctx && typeof ctx.json === 'function') {
        const parsed = await ctx.json();
        if (parsed && typeof parsed === 'object' && 'mensagem' in parsed && typeof parsed.mensagem === 'string') {
          detail = parsed.mensagem.trim();
        }
      }
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      code: 'invoke',
      message:
        detail ||
        (typeof error.message === 'string' && error.message.trim()) ||
        'Não foi possível contactar a função de envio. Confirme sessão, projeto Supabase e deploy de send-template-invite.',
    };
  }

  if (data == null || typeof data !== 'object') {
    return { ok: false, code: 'resposta', message: 'Resposta do serviço inválida. Tente de novo em instantes.' };
  }

  if (data.ok === true) {
    return { ok: true };
  }

  const msgFromServer = typeof data.mensagem === 'string' && data.mensagem.trim() ? data.mensagem.trim() : null;
  if (msgFromServer) {
    return { ok: false, code: 'resend', message: msgFromServer };
  }

  if (data.ok === false) {
    return { ok: false, code: 'resend', message: 'Não foi possível concluir o envio. Tente de novo em instantes.' };
  }

  return { ok: false, code: 'resend', message: 'Não foi possível concluir o envio. Tente de novo em instantes.' };
}

/**
 * Gera `mailto:` como fallback se o envio no servidor não estiver disponível.
 * @param {{ to: string, templateName: string, inviteUrl: string, kindLabel?: string, note?: string }} p
 */
export function buildMailtoInvite({ to, templateName, inviteUrl, kindLabel, note }) {
  const name = (templateName || 'Cadastro').trim();
  const subject = `Convite Obra10+ — ${name}`;
  const lines = [
    'Você foi convidado a completar o cadastro no Obra10+.',
    '',
    `Template: ${name}`,
    kindLabel ? `Perfil: ${kindLabel}` : null,
    note && String(note).trim() ? `Nota: ${String(note).trim()}` : null,
    '',
    `Link: ${inviteUrl}`,
  ].filter(Boolean);
  const body = lines.join('\n');
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

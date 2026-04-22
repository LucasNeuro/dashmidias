/**
 * Envia convite por e-mail (Resend). Chaves: RESEND_API_KEY (e opcional RESEND_FROM) em Edge Functions → Secrets.
 * Não use chave Resend no Render nem em VITE_*.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/** Mensagem apresentável ao utilizador (pt-BR), sem expor o fornecedor. */
function mensagemFalhaResend(status: number, bodyText: string): string {
  if (status === 401 || status === 403) {
    return "Não foi possível concluir o envio. Peça a um administrador para rever as credenciais de e-mail (API).";
  }
  let raw = bodyText;
  try {
    const j = JSON.parse(bodyText) as { message?: string | string[]; name?: string };
    if (j?.name === "application_error" || j?.name === "rate_limit") {
      return "Envio em excesso. Aguarde um momento e tente de novo.";
    }
    if (Array.isArray(j?.message)) {
      raw = j.message.join(" ");
    } else if (typeof j?.message === "string") {
      raw = j.message;
    }
  } catch {
    /* usa raw */
  }
  const m = (raw || "").toLowerCase();
  if (m.includes("from") || m.includes("domain") || m.includes("sender")) {
    return "O endereço de remetente não está autorizado. Defina um remetente válido (domínio verificado) no painel de e-mail, ou o endereço de teste do serviço.";
  }
  if (m.includes("validat") && (m.includes("to") || m.includes("recipients"))) {
    return "O e-mail de destino não pôde ser usado. Verifique o endereço e tente de novo.";
  }
  if (m.includes("api") && m.includes("key")) {
    return "A configuração de envio (chave) não é válida ou expirou. Atualize o segredo no painel do projeto, na área de funções (segredos).";
  }
  if (m.includes("only send") && m.includes("own")) {
    return "Neste ambiente de teste, só se pode receber o convite no e-mail da conta de envio. Use esse endereço ou conclua a verificação de um domínio.";
  }
  return "Não foi possível concluir o envio. Tente de novo em instantes; se persistir, use o botão “Link” e envie o endereço manualmente.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors });
  }

  const json = (body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ ok: false, mensagem: "Método não permitido." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnon) {
    return json({ ok: false, mensagem: "Configuração do serviço em falta. Contacte o apoio técnico." });
  }

  const auth = req.headers.get("Authorization");
  if (!auth) {
    return json({ ok: false, mensagem: "Sessão em falta. Inicie sessão e tente de novo." });
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: auth } },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return json({ ok: false, mensagem: "Sessão inválida. Inicie sessão e tente de novo." });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return json({
      ok: false,
      mensagem: "O envio automático ainda não está ativo. Use o link copiado (botão “Link”) até a equipe ativar a função de e-mail no servidor.",
    });
  }

  const from = Deno.env.get("RESEND_FROM")?.trim() || "Obra10+ <onboarding@resend.dev>";

  let body: { to?: string; subject?: string; html?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, mensagem: "Dados do pedido inválidos." });
  }

  const to = String(body.to ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const html = String(body.html ?? "").trim();
  if (!to || !subject || !html) {
    return json({ ok: false, mensagem: "E-mail, assunto e conteúdo são obrigatórios." });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  const text = await res.text();

  if (!res.ok) {
    const msg = mensagemFalhaResend(res.status, text);
    console.error("[send-template-invite] resend:", res.status, text);
    return json({ ok: false, mensagem: msg });
  }

  let id: string | undefined;
  try {
    const j = JSON.parse(text) as { id?: string };
    id = j?.id;
  } catch {
    /* resposta mínima */
  }
  if (!id) {
    console.warn("[send-template-invite] resposta 200 sem id:", text);
  }

  return json({ ok: true, id: id ?? null });
});

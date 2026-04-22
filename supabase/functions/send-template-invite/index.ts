/**
 * Envia convite por e-mail (Resend). Só responde em produção após deploy:
 * `supabase functions deploy send-template-invite` (pasta com `index.ts` nesta rota).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors });
  }

  /** Corpo JSON — HTTP 200 para o `functions.invoke` popular sempre `data` no browser. */
  const json = (body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ ok: false, error: "Método não permitido" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnon) {
    return json({ ok: false, error: "Configuração do Supabase em falta no servidor" });
  }

  const auth = req.headers.get("Authorization");
  if (!auth) {
    return json({ ok: false, error: "Não autenticado" });
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: auth } },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return json({ ok: false, error: "Sessão inválida" });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return json({ ok: false, error: "Defina o segredo RESEND_API_KEY no projeto (Edge Functions)" });
  }

  const from = Deno.env.get("RESEND_FROM")?.trim() || "Obra10+ <onboarding@resend.dev>";

  let body: { to?: string; subject?: string; html?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Corpo JSON inválido" });
  }

  const to = String(body.to ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const html = String(body.html ?? "").trim();
  if (!to || !subject || !html) {
    return json({ ok: false, error: "to, subject e html são obrigatórios" });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const t = await res.text();
    let msg = t;
    try {
      const j = JSON.parse(t) as { message?: string };
      if (j?.message) msg = j.message;
    } catch {
      /* ignore */
    }
    return json({ ok: false, error: msg || "Resend rejeitou o envio" });
  }

  return json({ ok: true });
});

/**
 * Sugere descrição curta para template de cadastro (admin HUB) via Mistral AI.
 * Secrets: MISTRAL_API_KEY (obrigatório), opcional MISTRAL_MODEL (ex.: mistral-small-latest).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const MAX_DESC = 200;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function trimDesc(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= MAX_DESC ? t : t.slice(0, MAX_DESC).trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors });
  }

  if (req.method !== "POST") {
    return json({ ok: false, mensagem: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnon) {
    return json({ ok: false, mensagem: "Configuração do serviço em falta." }, 500);
  }

  const auth = req.headers.get("Authorization");
  if (!auth) {
    return json({ ok: false, mensagem: "Sessão em falta." }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: auth } },
  });

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return json({ ok: false, mensagem: "Sessão inválida." }, 401);
  }

  /** Alinha-se ao AuthContext: RPC, depois hub_admins, perfis, profiles. */
  let mayUse = false;
  const { data: rpcAdmin, error: rpcErr } = await supabase.rpc("is_hub_admin");
  if (!rpcErr && rpcAdmin === true) mayUse = true;
  if (!mayUse) {
    const { data: ha } = await supabase.from("hub_admins").select("ativo").eq("user_id", user.id).maybeSingle();
    if (ha?.ativo === true) mayUse = true;
  }
  if (!mayUse) {
    const { data: perf } = await supabase.from("perfis").select("administrador_hub").eq("user_id", user.id).maybeSingle();
    if (perf?.administrador_hub === true) mayUse = true;
  }
  if (!mayUse) {
    const { data: prof } = await supabase.from("profiles").select("role, can_access_audit").eq("id", user.id).maybeSingle();
    if (prof?.role === "admin" || prof?.role === "owner" || prof?.can_access_audit === true) mayUse = true;
  }
  if (!mayUse) {
    return json({ ok: false, mensagem: "Apenas administradores podem usar esta função." }, 403);
  }

  const mistralKey = Deno.env.get("MISTRAL_API_KEY")?.trim();
  if (!mistralKey) {
    return json({
      ok: false,
      mensagem:
        "IA não configurada: defina o secret MISTRAL_API_KEY nas Edge Functions do Supabase e volte a publicar esta função.",
    }, 503);
  }

  const model = Deno.env.get("MISTRAL_MODEL")?.trim() || "mistral-small-latest";

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, mensagem: "Corpo JSON inválido." }, 400);
  }

  const templateName = String(body.templateName ?? "").trim() || "(sem nome)";
  const partnerKind = String(body.partnerKind ?? "").trim() || "—";
  const partnerKindLabel = String(body.partnerKindLabel ?? "").trim() || partnerKind;
  const partnerKindDescription = String(body.partnerKindDescription ?? "").trim() || "—";
  const cnpjRequired = body.cnpjRequired === true;
  const collectCpf = body.collectCpf === true;
  const inviteLinkEnabled = body.inviteLinkEnabled !== false;

  const userBlock = [
    `Nome do template: ${templateName}`,
    `Tipo de parceiro (código): ${partnerKind}`,
    `Tipo de parceiro (rótulo): ${partnerKindLabel}`,
    `Contexto do tipo: ${partnerKindDescription}`,
    `CNPJ obrigatório no cadastro: ${cnpjRequired ? "sim" : "não"}`,
    `Pedir CPF no cadastro: ${collectCpf ? "sim" : "não"}`,
    `Convite por link activo: ${inviteLinkEnabled ? "sim" : "não"}`,
  ].join("\n");

  const system =
    "És um assistente da plataforma Obra10+ (B2B, construção e parceiros). Gera UMA descrição curta em português do Brasil para catálogo interno de administradores: clara, profissional, sem markdown, sem aspas, sem emojis. Máximo 200 caracteres. Não inventes dados legais nem compromissos. Responde APENAS com o texto da descrição, numa única linha.";

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mistralKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 180,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Com base nos dados abaixo, escreve a descrição (máx. ${MAX_DESC} caracteres):\n\n${userBlock}` },
      ],
    }),
  });

  const rawText = await res.text();
  if (!res.ok) {
    console.error("[suggest-template-description] mistral", res.status, rawText.slice(0, 500));
    let msg = "O serviço de IA não respondeu. Tente de novo em instantes.";
    try {
      const j = JSON.parse(rawText) as { message?: string };
      if (typeof j.message === "string" && j.message.length < 200) msg = j.message;
    } catch {
      /* keep generic */
    }
    return json({ ok: false, mensagem: msg }, 502);
  }

  let content = "";
  try {
    const j = JSON.parse(rawText) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    content = String(j.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return json({ ok: false, mensagem: "Resposta da IA inválida." }, 502);
  }

  content = content.replace(/^["']|["']$/g, "").trim();
  const description = trimDesc(content);
  if (!description) {
    return json({ ok: false, mensagem: "A IA devolveu texto vazio. Ajuste o nome do template e tente de novo." }, 502);
  }

  return json({ ok: true, description });
});

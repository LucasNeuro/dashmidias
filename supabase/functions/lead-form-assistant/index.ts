/**
 * Chat assistente para montar campos extras de formulários de captura de leads (admin HUB).
 * Mistral interpreta intenções e devolve perguntas ou JSON final com campos.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const ALLOWED_TYPES = new Set([
  "text",
  "textarea",
  "number",
  "email",
  "tel",
  "url",
  "date",
  "select",
  "radio",
  "multiselect",
  "checkbox",
  "file",
]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

type ChatRole = "user" | "assistant";

type ChatTurn = { role: ChatRole; content: string };

function parseAssistantPayload(raw: string): {
  message: string;
  status: "asking" | "ready";
  fields: Array<Record<string, unknown>>;
} | null {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  try {
    const o = JSON.parse(s) as {
      message?: unknown;
      status?: unknown;
      fields?: unknown;
    };
    const message = String(o.message ?? "").trim();
    const status = o.status === "ready" ? "ready" : "asking";
    const rawFields = status === "ready" && Array.isArray(o.fields) ? o.fields : [];
    const fields: Array<Record<string, unknown>> = [];
    let n = 0;
    for (const row of rawFields) {
      if (n >= 15) break;
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const label = String(r.label ?? "").trim().slice(0, 240);
      if (!label) continue;
      let type = String(r.type ?? "text").toLowerCase().trim();
      if (!ALLOWED_TYPES.has(type)) type = "text";
      const required = Boolean(r.required);
      const out: Record<string, unknown> = { label, type, required };
      if (type === "select" || type === "radio" || type === "multiselect") {
        const opts = Array.isArray(r.options) ? r.options.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 35) : [];
        const uniq = [...new Set(opts)];
        out.options = uniq.length >= 2 ? uniq.slice(0, 30) : ["Opção A", "Opção B"];
      }
      if (type === "textarea" && typeof r.rows === "number" && r.rows > 0 && r.rows <= 20) {
        out.rows = Math.floor(r.rows);
      }
      fields.push(out);
      n += 1;
    }
    if (!message) return null;
    return { message, status, fields };
  } catch {
    return null;
  }
}

async function userMayUseAssistants(supabase: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data: rpcAdmin } = await supabase.rpc("is_hub_admin");
  if (rpcAdmin === true) return true;
  const { data: ha } = await supabase.from("hub_admins").select("ativo").eq("user_id", userId).maybeSingle();
  if (ha?.ativo === true) return true;
  const { data: perf } = await supabase.from("perfis").select("administrador_hub").eq("user_id", userId).maybeSingle();
  if (perf?.administrador_hub === true) return true;
  const { data: prof } = await supabase.from("profiles").select("role, can_access_audit").eq("id", userId).maybeSingle();
  if (prof?.role === "admin" || prof?.role === "owner" || prof?.can_access_audit === true) return true;
  return false;
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

  if (!(await userMayUseAssistants(supabase, user.id))) {
    return json({ ok: false, mensagem: "Apenas administradores podem usar o assistente." }, 403);
  }

  const mistralKey = Deno.env.get("MISTRAL_API_KEY")?.trim();
  if (!mistralKey) {
    return json({
      ok: false,
      mensagem:
        "IA não configurada: defina MISTRAL_API_KEY nas Edge Functions e volte a publicar.",
    }, 503);
  }

  const model = Deno.env.get("MISTRAL_MODEL")?.trim() || "mistral-small-latest";

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, mensagem: "Corpo JSON inválido." }, 400);
  }

  const rawMessages = body.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return json({ ok: false, mensagem: "Envie o histórico de mensagens (messages)." }, 400);
  }

  const messages: ChatTurn[] = [];
  for (const m of rawMessages) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role === "assistant" ? "assistant" : "user";
    const content = String((m as { content?: unknown }).content ?? "").trim();
    if (!content) continue;
    messages.push({ role, content: content.slice(0, 8000) });
  }
  if (messages.length === 0) {
    return json({ ok: false, mensagem: "Nenhuma mensagem válida." }, 400);
  }
  if (messages.length > 24) {
    return json({ ok: false, mensagem: "Histórico demasiado longo (máx. 24 mensagens)." }, 400);
  }

  const system =
    "És um assistente de produto Obra10+ que ajuda administradores a desenhar campos EXTRA de um formulário público de CAPTURA DE LEADS. " +
    "O formulário já pede nome, e-mail e telefone no site — NÃO incluas esses campos. " +
    "Tipos permitidos (campo type): text, textarea, number, email, tel, url, date, select, radio, multiselect, checkbox, file. " +
    "Para select, radio e multiselect deves preencher options (array de strings, no mínimo 2 opções distintas). " +
    "Se o utilizador ainda não deu informação suficiente para propor campos úteis, faz UMA ou DUAS perguntas claras sobre o objectivo ou o que quer perguntar ao lead. " +
    "Quando tiveres contexto suficiente, define status como ready e lista os campos desejados. " +
    "Responde SEMPRE e APENAS com um objeto JSON válido (sem Markdown fora do JSON). Formato:\\n" +
    '{ "message": "...", "status": "asking" | "ready", "fields": null | [ { "label", "type", "required", "options"? } ] }\\n' +
    "Se status for asking: fields deve ser null. message = pergunta(s) ou confirmação breve. " +
    "Se status for ready: fields é array (até 15 itens) com label, type, required, options se for select/radio/multiselect, rows opcional para textarea. " +
    "Sê objectivo; não inventes promessas legais nem dados sensíveis.";

  const payloadMessages = [{ role: "system", content: system }, ...messages.map((x) => ({ role: x.role, content: x.content }))];

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mistralKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 2048,
      messages: payloadMessages,
    }),
  });

  const rawText = await res.text();
  if (!res.ok) {
    console.error("[lead-form-assistant] mistral", res.status, rawText.slice(0, 500));
    return json({ ok: false, mensagem: "Serviço de IA indisponível. Tente de novo." }, 502);
  }

  let content = "";
  try {
    const j = JSON.parse(rawText) as { choices?: Array<{ message?: { content?: string } }> };
    content = String(j.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return json({ ok: false, mensagem: "Resposta da IA inválida." }, 502);
  }

  const parsed = parseAssistantPayload(content);
  if (!parsed) {
    return json({
      ok: false,
      mensagem: "Não consegui ler a sugestão da IA. Reformule ou tente outra vez.",
      rawSnippet: content.slice(0, 400),
    }, 502);
  }

  const outFields = parsed.status === "ready" ? parsed.fields : [];

  return json({
    ok: true,
    message: parsed.message,
    status: parsed.status,
    fields: outFields,
  });
});

import { getSupabase, isSupabaseConfigured } from './supabaseClient';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB — alinhar com limite do bucket no Supabase

/** Nome do bucket; definir o mesmo em `database/partner_signup_documents_bucket.sql`. */
export function partnerSignupDocsBucket() {
  const b = import.meta.env.VITE_PARTNER_SIGNUP_DOCS_BUCKET;
  return typeof b === 'string' && b.trim() ? b.trim() : 'partner_signup_documents';
}

/**
 * Envio público (anon) para o cadastro de parceiro. O caminho fica em `dados_formulario.extras`.
 * @param {File} file
 * @returns {Promise<string>} JSON serializado (guardar no campo extra)
 */
export async function uploadPartnerSignupExtraFile(file) {
  if (!file || !(file instanceof File)) {
    throw new Error('Ficheiro inválido.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Ficheiro demasiado grande (máx. ${Math.round(MAX_BYTES / 1024 / 1024)} MB).`);
  }
  if (!isSupabaseConfigured()) {
    throw new Error('Armazenamento não configurado (Supabase).');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Cliente Supabase indisponível.');

  const bucket = partnerSignupDocsBucket();
  const token =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const safeName = file.name.replace(/[^\w.\-()+ ]+/g, '_').replace(/_+/g, '_').slice(0, 160) || 'documento';
  const path = `signup_uploads/${token}/${safeName}`;

  const { error } = await sb.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível enviar o ficheiro. Verifique o bucket e as políticas RLS.');
  }

  return JSON.stringify({
    bucket,
    path,
    name: file.name,
    contentType: file.type || '',
    size: file.size,
    uploadedAt: new Date().toISOString(),
  });
}

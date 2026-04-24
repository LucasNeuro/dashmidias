/**
 * Upload de anexos do chat de homologação (bucket privado + RPC prepare).
 * SQL: database/hub_homologacao_documentos.sql
 */

export const HUB_HOMOLOG_DOCS_MAX_BYTES = 15 * 1024 * 1024;

/** @param {string} mime */
export function hubHomologacaoDocsMimeAllowed(mime) {
  const m = String(mime || '').toLowerCase().trim();
  return (
    m === 'application/pdf' ||
    m === 'image/jpeg' ||
    m === 'image/png' ||
    m === 'image/webp' ||
    m === 'image/gif' ||
    m === 'application/msword' ||
    m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export function hubHomologacaoDocsBucket() {
  const b = import.meta.env.VITE_HUB_HOMOLOG_DOCS_BUCKET;
  return typeof b === 'string' && b.trim() ? b.trim() : 'hub_homologacao_documentos';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} ref — codigo_rastreio ou UUID do pedido
 * @param {File} file
 * @returns {Promise<{ path: string, bucket: string }>}
 */
export async function uploadHomologacaoDocFile(supabase, ref, file) {
  if (!file || !(file instanceof File)) {
    throw new Error('Ficheiro inválido.');
  }
  if (file.size > HUB_HOMOLOG_DOCS_MAX_BYTES) {
    throw new Error(`Ficheiro demasiado grande (máx. ${Math.round(HUB_HOMOLOG_DOCS_MAX_BYTES / 1024 / 1024)} MB).`);
  }
  const mime = file.type || 'application/octet-stream';
  if (!hubHomologacaoDocsMimeAllowed(mime)) {
    throw new Error('Tipo de ficheiro não permitido (PDF, imagens ou Word).');
  }

  const rRef = String(ref || '').trim();
  if (!rRef) throw new Error('Referência do pedido em falta.');

  const { data, error } = await supabase.rpc('hub_public_homologacao_prepare_upload', {
    p_ref: rRef,
    p_filename: file.name,
    p_mime: mime,
    p_size: file.size,
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível preparar o envio.');
  }

  const payload = data && typeof data === 'object' ? data : null;
  if (!payload || payload.ok !== true) {
    const code = payload?.error;
    if (code === 'chat_closed') {
      throw new Error('Este pedido está encerrado — não é possível enviar anexos.');
    }
    if (code === 'mime_not_allowed') {
      throw new Error('Tipo de ficheiro não permitido.');
    }
    if (code === 'size_invalid') {
      throw new Error('Tamanho do ficheiro inválido.');
    }
    if (code === 'not_found') {
      throw new Error('Pedido não encontrado.');
    }
    throw new Error('Não foi possível preparar o envio.');
  }

  const path = payload.path != null ? String(payload.path) : '';
  const bucket = payload.bucket != null ? String(payload.bucket) : hubHomologacaoDocsBucket();
  if (!path) throw new Error('Caminho de armazenamento inválido.');

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: mime,
  });

  if (upErr) {
    throw new Error(upErr.message || 'Falha ao enviar o ficheiro para o armazenamento.');
  }

  return { path, bucket };
}

/**
 * Payload para `p_anexos` na RPC de envio de mensagem.
 * @param {string} storagePath
 * @param {File} file
 */
export function homologacaoFileToAnexoRpcPayload(storagePath, file) {
  return {
    path: storagePath,
    nome_original: file.name,
    mime_type: file.type || '',
    tamanho_bytes: file.size,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} storagePath
 * @param {number} [expiresSec]
 * @returns {Promise<string | null>}
 */
export async function homologacaoSignedUrl(supabase, storagePath, expiresSec = 3600) {
  const r = await homologacaoSignedUrlWithError(supabase, storagePath, expiresSec);
  return r.url;
}

/**
 * @returns {Promise<{ url: string | null, error: string | null }>}
 */
export async function homologacaoSignedUrlWithError(supabase, storagePath, expiresSec = 3600) {
  const path = String(storagePath || '').trim();
  if (!supabase || !path) return { url: null, error: !supabase ? 'sem_cliente' : 'sem_path' };
  const bucket = hubHomologacaoDocsBucket();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresSec);
  if (error) {
    return { url: null, error: error.message || 'signed_url_failed' };
  }
  const url = data?.signedUrl ?? null;
  return { url, error: url ? null : 'sem_url' };
}

/** @param {string} mime @param {string} [fileName] */
export function homologacaoLooksLikePdf(mime, fileName = '') {
  if (String(mime || '').toLowerCase().trim() === 'application/pdf') return true;
  return /\.pdf$/i.test(String(fileName || '').trim());
}

/** @param {string} mime @param {string} [fileName] */
export function homologacaoLooksLikeImage(mime) {
  return String(mime || '').toLowerCase().trim().startsWith('image/');
}

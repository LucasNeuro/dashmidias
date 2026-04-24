import { useCallback, useEffect, useState } from 'react';

const SUPPORT_ENV = import.meta.env.VITE_HUB_HOMOLOGACAO_CONTACT_EMAIL;

function storageKeyFor(codigo) {
  const c = String(codigo || '').trim();
  if (!c) return null;
  return `hub-homolog-notas-v1:${c}`;
}

function loadNotas(key) {
  if (!key || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotas(key, notas) {
  if (!key || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(notas));
  } catch {
    /* ignore quota */
  }
}

/**
 * Painel lateral: contacto por e-mail (opcional) + notas locais até haver API de mensagens.
 */
export function HomologacaoCommentsPanel({ open, onClose, codigoRastreio, nomeEmpresa }) {
  const [draft, setDraft] = useState('');
  const [notas, setNotas] = useState([]);

  const key = storageKeyFor(codigoRastreio);

  useEffect(() => {
    if (!open || !key) {
      setNotas([]);
      return;
    }
    setNotas(loadNotas(key));
    setDraft('');
  }, [open, key]);

  const addNota = useCallback(() => {
    const t = draft.trim();
    if (!t || !key) return;
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next = [{ id, texto: t, em: new Date().toISOString() }, ...notas];
    setNotas(next);
    saveNotas(key, next);
    setDraft('');
  }, [draft, key, notas]);

  const openMailto = useCallback(() => {
    const to = String(SUPPORT_ENV || '').trim();
    if (!to) return;
    const subject = encodeURIComponent(
      `Homologação Obra10+ — ${codigoRastreio || 'pedido'}`
    );
    const body = encodeURIComponent(
      `Código: ${codigoRastreio || '—'}\nOrganização: ${nomeEmpresa || '—'}\n\nEscreva a sua mensagem:\n\n`
    );
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }, [codigoRastreio, nomeEmpresa]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="homolog-comments-title">
      <button
        type="button"
        className="absolute inset-0 bg-primary/40 backdrop-blur-[1px]"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-outline-variant bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-low/50 px-4 py-3">
          <h2 id="homolog-comments-title" className="text-sm font-black uppercase tracking-widest text-primary">
            Comentários e contacto
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-outline-variant bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-low"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 hub-table-scrollbar">
          <div className="rounded-lg border border-slate-200/90 border-l-[3px] border-l-tertiary bg-white p-3 shadow-[inset_0_1px_0_rgba(15,23,42,0.04)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Equipa HUB</p>
            <p className="mt-2 text-sm leading-relaxed text-on-surface">
              As respostas oficiais sobre o seu pedido são enviadas por <strong>e-mail</strong> ou pelos canais que a equipa
              lhe indicar. Esta área serve para registar as suas notas e, quando configurado, abrir uma mensagem para o HUB.
            </p>
          </div>

          {SUPPORT_ENV ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={openMailto}
                className="w-full rounded-none bg-tertiary px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-primary hover:bg-tertiary/90"
              >
                Escrever à equipa (e-mail)
              </button>
              <p className="mt-2 text-xs text-on-surface-variant">
                O assunto e o código <span className="font-mono">{codigoRastreio || '—'}</span> são preenchidos automaticamente.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs leading-relaxed text-on-surface-variant">
              Para activar o botão de e-mail, defina <span className="font-mono">VITE_HUB_HOMOLOGACAO_CONTACT_EMAIL</span> no
              ambiente do front-end.
            </p>
          )}

          <div className="mt-6 border-t border-outline-variant pt-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">As suas notas</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Guardadas só neste dispositivo (não substituem o contacto oficial com o HUB).
            </p>
            <textarea
              className="mt-3 min-h-[88px] w-full resize-y rounded-none border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface"
              placeholder="Ex.: documentos enviados, dúvidas para lembrar…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!key}
            />
            <button
              type="button"
              disabled={!key || !draft.trim()}
              onClick={addNota}
              className="mt-2 rounded-none border-2 border-primary bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-surface-container-low disabled:opacity-40"
            >
              Guardar nota
            </button>

            {notas.length ? (
              <ul className="mt-4 space-y-3">
                {notas.map((n) => (
                  <li key={n.id} className="rounded-lg border border-outline-variant bg-surface-container-low/40 px-3 py-2">
                    <p className="text-[10px] text-on-surface-variant">
                      {new Date(n.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-on-surface">{n.texto}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-on-surface-variant">Nenhuma nota guardada ainda.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

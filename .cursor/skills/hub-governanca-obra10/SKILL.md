---
name: hub-governanca-obra10
description: Orienta trabalho na área de governança do Obra10+ HUB (rotas /adm, fila hub_solicitacoes_admin, AdminOnly, auditoria). Após alterações, exige confrontar docs em docs/ com o código e registar o que progrediu ou mudou. Usar quando o utilizador fala em governança HUB, /adm, aprovação admin, owner, hub_admins ou solicitações pendentes.
---

# Governança HUB — Obra10+

## Âmbito

- **UI:** `AdminAuditPage` (`/adm`), placeholders `/adm/configuracoes`, `/adm/templates`, `/adm/usuarios`.
- **Guards:** `AdminOnly`, `Protected` em [App.jsx](../../../frontend/src/App.jsx).
- **Identidade:** [AuthContext.jsx](../../../frontend/src/context/AuthContext.jsx) — `isAdmin`, `hubSolicitacaoPendente`, `identityReady`.
- **Pós-login:** [postLoginPath.js](../../../frontend/src/lib/postLoginPath.js) — `getPostLoginPath` (admin → `/adm`; pendente → `/acesso/pendente-hub`; senão `getParticipantHomePath(portal)`).
- **Owner (fila):** [hubOwner.js](../../../frontend/src/lib/hubOwner.js), `VITE_HUB_OWNER_EMAIL`.

## Referência rápida (ler antes de mudar comportamento)

| Documento | Conteúdo |
|-----------|----------|
| [ACESSOS_AUTH_E_GOVERNANCA.md](../../../docs/ACESSOS_AUTH_E_GOVERNANCA.md) | Rotas, guards, tabelas Supabase, env |
| [MKDS.md](../../../docs/MKDS.md) | UI auth (se tocar em formulários/layout) |
| [PLANEJAMENTO.md](../../../docs/PLANEJAMENTO.md) | Marco MVP auth/governança |

## Regras de implementação

1. **Não** confiar só na UI para permissões: RLS e políticas no Supabase são a fonte de verdade; `VITE_HUB_OWNER_EMAIL` filtra só a **visão** da fila no cliente.
2. Aprovar/rejeitar solicitação deve manter **coerência** entre `hub_solicitacoes_admin` e promoção em `hub_admins` (evitar estados ambíguos).

## Checklist ao terminar uma tarefa (obrigatório)

1. Abrir `docs/ACESSOS_AUTH_E_GOVERNANCA.md` (e § relevante do MKDS se aplicável).
2. Confrontar com `App.jsx`, `AuthContext.jsx`, `postLoginPath.js`, páginas alteradas.
3. Na resposta ao utilizador, secção **Retroativação:** bullets curtos (o que mudou no código; o que na doc foi atualizado ou o que ainda diverge e porquê).

## Nota

`create-skill` no Cursor é o fluxo de **criar este ficheiro SKILL.md** — não existe rota `/create-skill` na app React.

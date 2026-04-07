# Fluxo ideal para começar a construir o sistema

Ordem recomendada para **não travar** o time: primeiro **contrato de dados + segurança**, depois **telas** que consomem a API já protegida. Alinhado ao [PLANEJAMENTO.md](./PLANEJAMENTO.md) (M1–M12), [ARQUITETURA.md](./ARQUITETURA.md) e [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md).

---

## Visão em uma frase

**Supabase (schema + RLS + Auth) → React (shell + login + CRUD negócio) → Edge Functions (webhooks) → módulos e relatórios.**

---

## Fase 0 — Antes do primeiro commit de produto

| Passo | Ação | Saída |
|-------|------|--------|
| 0.1 | Fechar **convenção de nomes** SQL (português vs inglês) — registrar em ADR | Time alinhado |
| 0.2 | Criar projeto **Supabase** (dev + staging) | URLs e chaves em `.env` (não commitar segredos) |
| 0.3 | Criar app **React** (Vite ou CRA), repositório Git | Build local OK |
| 0.4 | Ler [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md) e [UI_LOGIN_E_IDENTIDADE.md](./UI_LOGIN_E_IDENTIDADE.md) | Escopo da primeira migration claro |

---

## Fase A — Fundação de dados e acesso (prioridade máxima)

Ordem **estrita** sugerida:

1. **Migration v0** — tabelas: `organizacoes`, `organizacao_membros`, `empresas`, `pessoas`, `pipeline_estagios`, `negocios`, `domain_events` (mínimo viável descrito no schema).
2. **Supabase Auth** — login e-mail (magic link ou senha, conforme decisão do produto).
3. **Trigger ou fluxo pós-cadastro** — ao criar usuário, opcionalmente criar `organizacao_membros` (primeiro usuário = admin da org de teste) ou fluxo de convite (Fase 1 pode ser script manual).
4. **RLS v0** — policies em **todas** as tabelas multi-tenant: `organizacao_id` visível só para membros da organização. **Sem RLS não há produção.**
5. **Seed** — uma organização demo, estágios de pipeline padrão, usuário teste.

**Critério de pronto:** dois usuários em organizações diferentes **não** veem dados um do outro (teste manual ou teste automatizado).

---

## Fase B — Produto mínimo no React

6. **Login** — Supabase Auth + rota protegida; UI conforme [UI_LOGIN_E_IDENTIDADE.md](./UI_LOGIN_E_IDENTIDADE.md).
7. **Shell** — layout (sidebar/top), contexto de organização atual (se multi-org).
8. **Lista + detalhe de `negocios`** — criar, editar, listar; associar estágio do pipeline.
9. **Registro de eventos** — ao criar negócio / mudar estágio, inserir linha em `domain_events` (app ou RPC).

**Critério de pronto:** usuário autenticado gerencia negócios só da sua organização; timeline de eventos visível no detalhe (mesmo que simples).

---

## Fase C — Entidades satélite da Fase 1

10. **Oportunidade / lead** — se separar de `negocios`, migration + telas; senão, usar `negocios` com `origem` e estágio inicial (mais rápido).
11. **`imoveis`** + vínculo opcional com `negocio_id`.
12. **`contratos`** + Storage para arquivo (policies de Storage alinhadas à org).
13. **`projetos`** / **`obras`** mínimo + FK `negocio_id`.
14. **`pagamentos`** mínimo (estado + valor + `negocio_id`).

**Critério de pronto:** encadeamento visual “negócio → contrato / imóvel / pagamento” ainda que básico.

---

## Fase D — Integrações (servidor)

15. **Edge Function** — webhook stub (POST) que valida payload, aplica idempotência, insere oportunidade/negócio com `origem`.
16. **WhatsApp (uazapi)** — seguir [GUIA_CAPTACAO_WHATSAPP_UAZAPI.md](./GUIA_CAPTACAO_WHATSAPP_UAZAPI.md); apontar webhook para a mesma função ou função dedicada.

---

## O que não fazer no início

- Montar **todos** os módulos (fornecedor, cliente, onboarding) antes do núcleo **negócio + RLS**.
- Expor **service role** ou tokens de integração no React.
- Criar dezenas de tabelas sem **primeira migration** aplicada e revisada.

---

## Documentos que sustentam este fluxo

| Documento | Papel |
|-----------|--------|
| [ARQUITETURA.md](./ARQUITETURA.md) | Camadas, fluxos, segurança |
| [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md) | Tabelas e relacionamentos v0 |
| [PLANEJAMENTO.md](./PLANEJAMENTO.md) | Marcos M1–M12 |
| [SPEC.md](./SPEC.md) | Regras de negócio |

---

*Revisar este fluxo a cada marco concluído; ajustar ordem se o negócio priorizar imóvel antes de contrato, etc.*

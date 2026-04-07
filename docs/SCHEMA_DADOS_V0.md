# Modelo de dados v0 — Obra10+ HUB (Supabase / Postgres)

Primeira versão do **esquema relacional** para **começar as bases**: multi-tenant, **negócio** no centro, eventos, anexos mínimos para Fase 1. Não substitui migrations versionadas no código; serve como **contrato** entre produto e engenharia.

**Convenção:** nomes de tabelas e colunas em **português_snake_case** (alinhado ao [PLANEJAMENTO.md](./PLANEJAMENTO.md) M3). Tipos indicativos; ajustar `uuid`/`timestamptz` nas migrations reais.

**Chave multi-tenant:** `organizacao_id` em (quase) toda tabela de negócio.

**Slugs (URLs):** convenção documentada na **§7**; nem toda entidade precisa de `slug` público.

---

## 1. Diagrama entidade-relacionamento (texto)

```
organizacoes
    ↑
organizacao_membros —— auth.users
    ↑
empresas, pessoas, pipeline_estagios, fornecedores (MVP induzido)
    ↑
negocios —— pipeline_estagios
    ↑
imoveis, contratos, projetos, obras, pagamentos, negocio_fornecedores (opcional v0 tardio)
domain_events → negocio_id (opcional) + organizacao_id
```

---

## 2. Tabelas core

### 2.1 `organizacoes`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | `gen_random_uuid()` |
| `nome` | text | Nome fantasia / razão curta |
| `slug` | text UNIQUE | Opcional; URL-friendly |
| `criado_em` | timestamptz | default now() |
| `atualizado_em` | timestamptz | |

### 2.2 `organizacao_membros`

Vínculo **usuário autenticado ↔ organização** + papel (RBAC v0).

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organizacao_id` | uuid FK → organizacoes | ON DELETE CASCADE |
| `user_id` | uuid FK → auth.users | |
| `papel` | text | Ex.: `admin_organizacao`, `membro`, `corretor` — evoluir para enum |
| `criado_em` | timestamptz | |

**Unique:** `(organizacao_id, user_id)`.

**Índices:** `(user_id)`, `(organizacao_id)`.

### 2.3 `empresas`

Empresas com as quais o HUB se relaciona (cliente PJ, parceiro).

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organizacao_id` | uuid FK | |
| `razao_social` | text | |
| `nome_fantasia` | text | nullable |
| `documento` | text | CNPJ etc.; nullable no início |
| `criado_em` / `atualizado_em` | timestamptz | |

### 2.4 `pessoas`

Contatos humanos (podem ligar a usuário depois).

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organizacao_id` | uuid FK | |
| `nome` | text | |
| `email` | text | nullable |
| `telefone` | text | E.164 recomendado |
| `empresa_id` | uuid FK → empresas | nullable |
| `user_id` | uuid FK → auth.users | nullable; se a pessoa for usuário do sistema |
| `criado_em` / `atualizado_em` | timestamptz | |

### 2.5 `pipeline_estagios`

Estágios do funil **por organização** (ou por “tipo de pipeline” futuro).

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organizacao_id` | uuid FK | |
| `nome` | text | Ex.: Novo, Qualificado, Proposta |
| `ordem` | int | Ordenação no kanban |
| `codigo` | text | Opcional; estável para integrações |
| `criado_em` | timestamptz | |

**Índice:** `(organizacao_id, ordem)`.

### 2.6 `negocios` (centro — `ID_NEGOCIO`)

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | **Identificador do negócio** |
| `organizacao_id` | uuid FK | |
| `titulo` | text | Nome resumido da oportunidade |
| `slug` | text | Opcional; ver **§7** — único por `(organizacao_id, slug)` |
| `pipeline_estagio_id` | uuid FK → pipeline_estagios | |
| `valor_estimado` | numeric(14,2) | nullable |
| `moeda` | text | default `BRL` |
| `origem` | text | `manual`, `whatsapp`, `meta`, `google`, etc. |
| `origem_detalhe` | jsonb | nullable — UTM, campanha, ids externos |
| `responsavel_user_id` | uuid FK → auth.users | nullable |
| `pessoa_principal_id` | uuid FK → pessoas | nullable |
| `empresa_principal_id` | uuid FK → empresas | nullable |
| `criado_em` / `atualizado_em` | timestamptz | |

**Índices:** `(organizacao_id)`, `(pipeline_estagio_id)`, `(origem)`, `(criado_em DESC)`.

> **Alternativa:** tabela `oportunidades` separada que promove para `negocios` — só se o time quiser distinguir lead cru de negócio qualificado. Na v0, **um registro em `negocios`** com estágio inicial costuma bastar.

### 2.7 `domain_events`

Append-only lógico (não deletar em produção salvo LGPD).

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organizacao_id` | uuid FK | |
| `tipo` | text | Ex.: `LEAD_CRIADO`, `NEGOCIO_FECHADO`, `MENSAGEM_RECEBIDA_WHATSAPP` |
| `negocio_id` | uuid FK → negocios | nullable se evento for global da org |
| `ator_user_id` | uuid | nullable; `auth.uid()` ou null para sistema |
| `payload` | jsonb | Contexto mínimo |
| `criado_em` | timestamptz | default now() |
| `ocorrido_em` | timestamptz | nullable; instante do **fato** (ex.: assinatura, confirmação Pix); default lógico = `criado_em` |
| `fonte` | text | nullable; ex.: `app`, `webhook_fintech`, `webhook_assinatura`, `edge_function`, `sistema` |
| `idempotencia_chave` | text | nullable; UNIQUE parcial com `organizacao_id` — dedupe webhook/retry |
| `correlacao_id` | uuid | nullable; agrupa eventos da mesma transação (fintech, escrow) |

**Índice:** `(organizacao_id, negocio_id, criado_em DESC)`, `(organizacao_id, tipo)`.

**Contrato de tipos, fintech e payloads:** [EVENTOS_SERVICO_E_FINTECH.md](./EVENTOS_SERVICO_E_FINTECH.md).

---

## 3. Tabelas Fase 1 (logo após o core)

### 3.1 `imoveis`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organizacao_id` | uuid FK | |
| `negocio_id` | uuid FK | nullable — imóvel pode existir antes do vínculo |
| `slug` | text | Opcional; único por `(organizacao_id, slug)` — ver **§7** |
| `endereco_resumido` ou campos de endereço | text / jsonb | Evoluir para colunas normalizadas |
| `criado_em` / `atualizado_em` | timestamptz | |

### 3.2 `contratos`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organizacao_id` | uuid FK | |
| `negocio_id` | uuid FK | **obrigatório** quando contrato existir |
| `titulo` | text | |
| `slug` | text | Opcional; único por `(organizacao_id, slug)` |
| `status` | text | `rascunho`, `enviado`, `assinado`, etc. |
| `storage_path` | text | nullable; caminho no Supabase Storage |
| `assinado_em` | timestamptz | nullable |
| `criado_em` / `atualizado_em` | timestamptz | |

### 3.3 `projetos` (arquitetura)

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organizacao_id` | uuid FK | |
| `negocio_id` | uuid FK | |
| `nome` | text | |
| `slug` | text | Opcional; único por `(organizacao_id, slug)` |
| `status` | text | |
| `criado_em` / `atualizado_em` | timestamptz | |

### 3.4 `obras` (execução)

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organizacao_id` | uuid FK | |
| `negocio_id` | uuid FK | |
| `nome` | text | |
| `slug` | text | Opcional; único por `(organizacao_id, slug)` |
| `status` | text | |
| `criado_em` / `atualizado_em` | timestamptz | |

### 3.5 `pagamentos`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organizacao_id` | uuid FK | |
| `negocio_id` | uuid FK | |
| `valor` | numeric(14,2) | |
| `status` | text | `registrado`, `retido`, `liberado`, `cancelado` |
| `descricao` | text | nullable |
| `provedor` | text | nullable — ex.: id do PSP/BaaS quando integrado |
| `provedor_conta_id` | text | nullable — id da conta/virtual account no provedor |
| `provedor_pagamento_id` | text | nullable — id da transação/cobrança no provedor |
| `criado_em` / `atualizado_em` | timestamptz | |

> Colunas `provedor_*` preparadas para o fluxo **contrato assinado → API do provedor → webhook** (ver [SPEC §5.9](./SPEC.md) e [ARQUITETURA §3.4](./ARQUITETURA.md)); podem ficar `NULL` na Fase 1.

### 3.6 `fornecedores` e `negocio_fornecedores` (MVP — cadastro induzido)

Alinhado ao [SPEC.md §3.3](./SPEC.md): no **primeiro momento**, o fornecedor é cadastrado por **usuário da organização** (ex.: **arquiteto**, **admin**) — não depende de login do fornecedor.

**`fornecedores`** (cadastro mestre na org):

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organizacao_id` | uuid FK | Org que **mantém** o cadastro (escritório, imobiliária, etc.) |
| `nome` | text | Razão ou nome fantasia |
| `documento` | text | nullable — CNPJ/CPF se houver |
| `email` / `telefone` | text | nullable |
| `especialidade` | text | nullable — ex.: marcenaria |
| `criado_por_user_id` | uuid FK → auth.users | Quem criou (rastreio) |
| `origem_cadastro` | text | Ex.: `induzido_arquiteto`, `induzido_admin_org`; futuro `autonomo` |
| `criado_em` / `atualizado_em` | timestamptz | |

**`negocio_fornecedores`** (N:N — vínculo ao **núcleo**):

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organizacao_id` | uuid FK | Mesma org do negócio (v0) |
| `negocio_id` | uuid FK → negocios | |
| `fornecedor_id` | uuid FK → fornecedores | |
| `papel` | text | nullable — ex.: `marcenaria`, `instalacao` |
| `criado_em` | timestamptz | |

**Unique sugerido:** `(negocio_id, fornecedor_id)` se um fornecedor não repetir o mesmo papel duas vezes no mesmo negócio.

> **Evolução Fase 2:** `fornecedor.user_id` nullable → preenchido quando o parceiro aceitar convite; homologação e documentos; possível **compartilhamento** de cadastro entre orgs — fora do escopo mínimo acima.

---

## 4. Integração WhatsApp (opcional na mesma migration ou seguinte)

Ver [GUIA_CAPTACAO_WHATSAPP_UAZAPI.md](./GUIA_CAPTACAO_WHATSAPP_UAZAPI.md).

| Tabela | Função |
|--------|--------|
| `whatsapp_instancias` | `organizacao_id`, identificador da instância uazapi, **sem** token em texto claro se possível (vault/secret) |
| `whatsapp_mensagens` | opcional v0 — `organizacao_id`, `wa_chatid`, `payload`, `criado_em` |

**Idempotência:** unique `(organizacao_id, wa_chatid)` em tabela de captação ou campo em `negocios.origem_detalhe`.

---

## 5. RLS (regra geral)

Para cada tabela com `organizacao_id`:

- **SELECT/INSERT/UPDATE:** permitir se `organizacao_id` pertencer a uma linha de `organizacao_membros` com `user_id = auth.uid()`.
- **DELETE:** restrito (soft delete preferível no futuro) ou só `admin_organizacao`.

Políticas finas por `papel` ficam para [RLS.md](./RLS.md) (a criar) ou migrations comentadas.

---

## 7. Slugs — convenção por entidade e rotas

**Objetivo:** URLs legíveis e estáveis no front (React Router), sem expor dados sensíveis. O **identificador canônico** continua sendo **`id` (uuid)**; o `slug` é complementar (SEO, compartilhamento, suporte).

### 7.1 Regras gerais de formato

| Regra | Detalhe |
|--------|---------|
| Alfabeto | Apenas **`a-z`**, **`0-9`** e **hífen** (`-`) |
| Normalização | Minúsculas; remover acentos (á→a, ç→c); espaços e underscores → `-` |
| Colapso | Sem hífens duplicados nem nas pontas |
| Tamanho | Sugestão: **máx. 80** caracteres; truncar palavra no limite |
| Colisão | Se `slug` já existir no **escopo de unicidade**, acrescentar sufixo `-2`, `-3`, … ou curto hash |
| Geração | Automática a partir de `titulo` / `nome` / endereço resumido no **insert/update** (trigger ou app) |

### 7.2 Unicidade (escopo)

| Entidade / tabela | Coluna | Unicidade | Observação |
|-------------------|--------|-----------|------------|
| **Organização** | `organizacoes.slug` | **Global** na plataforma | Já no §2.1; necessário para `/o/:orgSlug` sem ambiguidade entre parceiros |
| **Negócio** | `negocios.slug` | **Por organização** | `UNIQUE (organizacao_id, slug)` onde `slug IS NOT NULL` |
| **Imóvel** | `imoveis.slug` | Por organização | Idem |
| **Projeto** | `projetos.slug` | Por organização | Idem |
| **Obra** | `obras.slug` | Por organização | Idem |
| **Contrato** | `contratos.slug` | Por organização | Opcional; útil para link interno, não obrigatório no v0 |
| **Empresa** | `empresas.slug` | Por organização | Opcional em migration futura |
| **Pessoa** | — | — | **Evitar slug público** por LGPD; usar só `id` em rotas admin autenticadas |
| **Pipeline / estágio** | `pipeline_estagios.codigo` | Por organização | Identificador estável **tipo slug** (ex.: `qualificado`); não precisa segunda coluna |
| **Produto / serviço** | (tabelas futuras) | Por organização | Mesmo padrão `slug` + `UNIQUE (organizacao_id, slug)` |
| **Fornecedor** | (tabela futura) | Por organização | Idem |
| **Pagamento** | — | — | **Sem slug em URL pública**; rotas apenas com `id` e auth forte |
| **Pós-venda** | — | — | Normalmente aninhado ao negócio: `/negocios/:id/pos-venda` sem slug próprio |
| **domain_events** | — | — | Sem slug; imutável por `id` |

**Partial unique index (Postgres):** para linhas com `slug` preenchido, usar `CREATE UNIQUE INDEX ... ON negocios (organizacao_id, slug) WHERE slug IS NOT NULL;`

### 7.3 Segmentos de rota sugeridos (React)

Prefixo com **organização** quando o app for multi-tenant por path (alinhado a `organizacoes.slug`):

| Segmento (plural PT) | Entidade | Exemplo de path |
|----------------------|----------|-----------------|
| `o` ou `org` | — | `/o/:orgSlug` (atalho) |
| `negocios` | Negócio | `/o/:orgSlug/negocios/:id` ou `.../:id-:slug` |
| `imoveis` | Imóvel | `/o/:orgSlug/imoveis/:id` |
| `projetos` | Projeto | `/o/:orgSlug/projetos/:id` |
| `obras` | Obra | `/o/:orgSlug/obras/:id` |
| `contratos` | Contrato | `/o/:orgSlug/contratos/:id` |
| `pessoas` | Pessoa | só **área logada**; preferir `/o/:orgSlug/pessoas/:id` sem expor em links públicos |
| `empresas` | Empresa | `/o/:orgSlug/empresas/:id` |
| `pagamentos` | Pagamento | `/o/:orgSlug/negocios/:negocioId/financeiro` ou similar — evitar slug |

**Resolução:** o front pode carregar por **`id` (uuid)** na rota; se houver `slug` na URL, validar que bate com o registro ou redirecionar para o canônico (`301`).

### 7.4 Portal do cliente

Rotas ainda mais curtas e neutras, sem expor nomes de org se desejado: ex. `/portal/:tokenOuConvite` ou `/c/:hash`, com **token assinado**; alternativa: mesmo padrão `/o/:orgSlug/...` com sessão de cliente.

---

## 8. Próximos passos no repositório

1. `supabase migration new core_v0` com as tabelas **2.1–2.7**.
2. Habilitar RLS e policies mínimas.
3. Seed de `pipeline_estagios` e organização demo.
4. Expandir com **§3** conforme [FLUXO_INICIO_DESENVOLVIMENTO.md](./FLUXO_INICIO_DESENVOLVIMENTO.md).

---

## Documentos relacionados

- [ARQUITETURA.md](./ARQUITETURA.md)
- [FLUXO_INICIO_DESENVOLVIMENTO.md](./FLUXO_INICIO_DESENVOLVIMENTO.md)
- [SPEC.md](./SPEC.md)

---

*Schema v0 — revisar após primeira sprint de implementação.*

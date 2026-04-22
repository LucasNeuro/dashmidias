# CRM HUB Obra Dezmais — templates de cadastro, schema em escala e alinhamento com Postgres

Este documento **complementa** o mapa comercial já fixado em [CRM_MAPA_COMERCIAL_CONTROLE_ORG.md](./CRM_MAPA_COMERCIAL_CONTROLE_ORG.md) e o modelo v0 em [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md). Foca em:

- **Escala** ao sair do `localStorage` e persistir **templates de formulário** e **tipos de parceiro** no Supabase.
- **Tabelas auxiliares** necessárias para não “colar” JSON solto sem versionamento nem integridade.
- **Regra de produto** (CRM = venda) e **módulos** — resumo com remissão ao mapa detalhado.

**Não substitui migrations versionadas** no repositório; é **contrato de produto + desenho físico sugerido**.

---

## 1. Regra central do sistema

**CRM = venda.** O CRM não controla execução, entrega de obra, andamento de projeto ou produção.

O CRM cobre: captar lead → qualificar → negociar → fechar → perder → medir performance comercial. O que vier **depois do fechado** pertence a **módulos operacionais** (fora do CRM puro).

Detalhamento por módulo (Governança, Imobiliário, Arquitetura, Serviços, Produtos), pipelines, KPIs, alertas e UX: ver [CRM_MAPA_COMERCIAL_CONTROLE_ORG.md](./CRM_MAPA_COMERCIAL_CONTROLE_ORG.md).

---

## 2. Alinhamento com o schema Postgres (contexto)

O dump de referência inclui, entre outras, tabelas que já sustentam multi-tenant e comercial:

| Área | Tabelas (exemplos) | Papel |
|------|-------------------|--------|
| Identidade / HUB | `perfis`, `hub_admins`, `hub_solicitacoes_admin`, `convites_administrador_hub` | Quem é admin da plataforma, pedidos de acesso |
| Organização | `organizacoes`, `organizacao_membros`, `organizacao_modulos`, `organizacao_convites`, `papel_template`, `permissao_recursos` | Tenant, papéis, módulos ativos, convites por e-mail |
| CRM / negócio | `negocios`, `pipeline_estagios`, `pessoas`, `empresas`, `domain_events` | Oportunidades, estágios, pessoas, empresas, eventos de domínio |
| Relatórios mídia | `reports`, `campaigns`, `channels`, etc. | Painel de performance de mídia (paralelo ao CRM comercial) |

**Coluna útil já existente:** `organizacoes.tipo_organizacao` (text) — candidata a receber o **slug** do tipo de parceiro do HUB (ver §4), alinhado ao catálogo `hub_partner_kind.slug`.

**Convites de organização:** `organizacao_convites` cobre convites **com e-mail + papel**; o fluxo **público de cadastro por link com template** é complementar (primeiro contato sem convite pré-gerado).

---

## 3. Templates de cadastro (estado atual no frontend)

Hoje os **templates** de cadastro de organização parceira vivem no browser (`localStorage`), com:

- nome, descrição interna curta;
- **`partner_kind`** — catálogo em código: [frontend/src/lib/hubPartnerKinds.js](../frontend/src/lib/hubPartnerKinds.js);
- lista de **campos extras** (rótulo, tipo, obrigatoriedade, opções para select/radio/multiselect);
- chaves `extras.*` derivadas do rótulo para o payload.

Isso serve para **prototipar UX**; em escala exige **persistência no Postgres**, **auditoria** e **RLS**.

---

## 4. Catálogo de tipos de parceiro (tabela auxiliar)

**Objetivo:** uma única fonte de verdade para o HUB (labels, ordem, ativo/inativo), usada por:

- templates de cadastro (`partner_kind_id` ou `slug` estável);
- `organizacoes.tipo_organizacao` ou FK futura;
- governança (“performance por área”: Imobiliário, Arquitetura, Serviços, Produtos alinhados aos slugs).

**Arquivo de referência (stub SQL comentado):** [database/hub_partner_kinds.sql](../database/hub_partner_kinds.sql).

**Slugs atuais no código** (espelhar na tabela ao migrar):

| `slug` | Uso |
|--------|-----|
| `arquitetos` | Parceiros de arquitetura |
| `engenharias` | Engenharias |
| `prestadores_servico` | Prestadores de serviço |
| `parceiros_produtos` | Parceiros de produtos |
| `imobiliarios` | Imobiliários |

**DDL sugerido (resumo):**

```sql
-- hub_partner_kind: catálogo global, poucas linhas, versionável por seed/migration
CREATE TABLE public.hub_partner_kind (
  id smallserial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  sort_order smallint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Regra de migração:** templates e organizações antigas que usavam valores legados (`midia`, `agencia`, …) devem ser **normalizados** (o frontend já faz mapa em `normalizePartnerKindSlug`).

---

## 5. Templates de formulário em escala

### 5.1 Problema

Sem tabelas dedicadas, `jsonb` solto em uma coluna dificulta:

- histórico de versões do template;
- validação de `key` duplicada;
- relatórios por campo;
- RLS (“só admin da org X edita template da org X”).

**Estado actual no Supabase (Obra10+):** existe `public.registration_form_template` com coluna **`fields jsonb`** (array de campos extra), **sem** `slug` e **sem** tabela `registration_form_template_field`. O frontend e `database/registration_form_template_rls_production.sql` alinham-se a este schema. O modelo em duas tabelas abaixo permanece referência para evolução.

### 5.2 Modelo sugerido (duas tabelas + opcional submissões)

**A) `registration_form_template`**

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `slug` | text UNIQUE | Opcional; para URLs estáveis |
| `name` | text | Nome do template |
| `description` | text | Descrição interna (equipa) |
| `hub_partner_kind_id` | smallint FK → `hub_partner_kind.id` | Perfil esperado do parceiro |
| `created_by_user_id` | uuid FK → `auth.users` | Quem criou |
| `organization_id` | uuid FK → `organizacoes` NULL | Se NULL = template global da plataforma; se preenchido = template da org |
| `active` | boolean | Soft delete |
| `version` | int | Incrementar a cada publicação relevante |
| `created_at` / `updated_at` | timestamptz | |

**B) `registration_form_template_field`**

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `template_id` | uuid FK → `registration_form_template` ON DELETE CASCADE | |
| `sort_order` | int | |
| `field_key` | text | Slug estável (`extras` no JSON); UNIQUE por `(template_id, field_key)` |
| `label` | text | Rótulo exibido |
| `field_type` | text | `text`, `textarea`, `select`, `radio`, `multiselect`, … |
| `required` | boolean | |
| `options` | jsonb | Lista de strings para tipos com opções; `[]` nos demais |
| `created_at` / `updated_at` | timestamptz | |

**Índices:** `(template_id, sort_order)`; `(template_id, field_key)`.

**C) Opcional — `registration_form_submission`** (auditoria / onboarding)

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `template_id` | uuid FK | |
| `submitted_at` | timestamptz | |
| `payload` | jsonb | Snapshot validado (dados empresa + extras + metadados) |
| `auth_user_id` | uuid NULL | Preenchido após `signUp` |
| `organizacao_id` | uuid NULL | Preenchido após criar organização |

Isso liga o **cadastro público** a `organizacoes` e `auth.users` sem misturar com `negocios` até existir oportunidade comercial explícita.

---

## 6. Relação com o CRM (negócios, leads, módulos)

- **Cadastro de organização parceira** (template) **não é** ainda um pipeline de CRM; é **onboarding de tenant** e classificação (`hub_partner_kind`).
- Depois do onboarding, **oportunidades** (`negocios`) devem respeitar o **módulo CRM** ativo em `organizacao_modulos` + `modulos_catalogo` (ver [MODULOS_PERMISSOES_E_HUB.md](./MODULOS_PERMISSOES_E_HUB.md)).
- **Fechado comercial** no CRM pode disparar `domain_events` e, no futuro, **handoff** para módulos operacionais — sem duplicar execução dentro do CRM (regra de ouro no mapa comercial).

O **modelo comum** Lead / Cliente / Oportunidade / Atividade descrito no mapa comercial continua o alvo; as tabelas `pessoas`, `empresas`, `negocios` já são o núcleo no schema v0.

---

## 7. UX e design (todas as telas CRM)

Resumo alinhado ao HUB:

- **Paleta:** verde escuro institucional, dourado para destaque, fundo claro, cinzas suaves.
- **Leitura rápida:** poucos blocos, foco em ação; evitar gráfico ornamental, cards redundantes, texto minúsculo, excesso de borda.
- **Interação mínima:** filtro por período, origem, responsável, etapa; busca por nome/telefone/e-mail; detalhe lateral ou modal; registrar próxima ação.

Detalhes por módulo (pipelines, KPIs, alertas): [CRM_MAPA_COMERCIAL_CONTROLE_ORG.md](./CRM_MAPA_COMERCIAL_CONTROLE_ORG.md).

---

## 8. Perfis de acesso (resumo)

- **Administrador:** visão global, exportação, gestão de templates globais (se aplicável).
- **Gestor:** módulo completo da sua frente; pipeline e alertas.
- **Comercial:** oportunidades atribuídas; atividades e etapas permitidas.
- **Diretoria:** governança e relatórios consolidados; edição operacional opcional/nula.

Implementação técnica: `papel_template`, `organizacao_membros`, `permissao_recursos` — ver [ACESSOS_AUTH_E_GOVERNANCA.md](./ACESSOS_AUTH_E_GOVERNANCA.md).

---

## 9. Checklist de implementação (engenharia)

1. Aplicar migration `hub_partner_kind` + seed dos slugs alinhados a [hubPartnerKinds.js](../frontend/src/lib/hubPartnerKinds.js).
2. RLS em `registration_form_template` (`registration_form_template_rls_production.sql`; campos em `fields` jsonb). Opcional futuro: normalizar em tabela filha.
3. Substituir leitura/gravação de templates no frontend por API Supabase (ou Edge Functions) com **mesma semântica** de `extras` e `partner_kind`.
4. Opcional: `registration_form_submission` para rastrear cadastros públicos antes do login.
5. Preencher `organizacoes.tipo_organizacao` (ou FK) a partir do `hub_partner_kind` escolhido no template.
6. Manter **CNPJA / endereço** como enriquecimento no cliente; payload persistido em `empresas` + colunas normalizadas conforme [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md).

---

## 10. Documentos relacionados

| Documento | Conteúdo |
|-----------|----------|
| [CRM_MAPA_COMERCIAL_CONTROLE_ORG.md](./CRM_MAPA_COMERCIAL_CONTROLE_ORG.md) | Módulos CRM, pipelines, entidades comuns, regras de negócio |
| [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md) | ER v0, convenções, multi-tenant |
| [CADASTRO_ORGANIZACOES_E_USUARIOS.md](./CADASTRO_ORGANIZACOES_E_USUARIOS.md) | Fluxo de organizações, convites, admin HUB |
| [MODULOS_PERMISSOES_E_HUB.md](./MODULOS_PERMISSOES_E_HUB.md) | Módulos e permissões |

---

*Última atualização: documento criado para alinhar templates de cadastro, tipos de parceiro e evolução do schema Postgres com o produto CRM HUB Obra Dezmais.*

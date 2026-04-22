---
name: obra10-implementacao-base-docs
description: Antes de implementar ou alterar o projeto dashmidias, orienta a ler docs/, confrontar com o código existente e escolher a abordagem mais viável. Usar em qualquer tarefa de código (frontend, Supabase, rotas, UI, cadastros, CRM), quando o utilizador pede features, refactors ou alinhamento com a documentação.
---

# Implementação alinhada a docs e à base de código

## Quando aplicar

- Nova funcionalidade, refactor, correção transversal ou alteração de contrato (API, schema, RLS).
- O utilizador menciona documentação, viabilidade, padrões Obra10+ ou pasta `docs/`.

## Fluxo obrigatório (ordem)

1. **Identificar documentos relevantes em `docs/`** (lista abaixo) e **ler** pelo menos os trechos do âmbito da tarefa — não implementar só por memória genérica.
2. **Inspecionar o código existente** (`grep`, `SemanticSearch`, abrir ficheiros já usados no mesmo domínio): imports, convenções de pastas, hooks, contextos, estilos (`index.css` / tokens `@theme`).
3. **Escolher a solução mais viável**: reutilizar o que já existe; alinhar com `MKDS.md` e com formulários/layout já usados (ex.: login, `AuthSplitLayout`, `border-2 border-primary`).
4. **Só depois** escrever ou alterar código. Evitar escopos largos não pedidos.

## Índice rápido de `docs/`

| Documento | Uso |
|-----------|-----|
| [SPEC.md](../../../docs/SPEC.md) | Visão do produto, requisitos |
| [ARQUITETURA.md](../../../docs/ARQUITETURA.md) | Stack, camadas, front/back |
| [MKDS.md](../../../docs/MKDS.md) | UI, identidade, padrões de ecrãs |
| [ACESSOS_AUTH_E_GOVERNANCA.md](../../../docs/ACESSOS_AUTH_E_GOVERNANCA.md) | Auth, rotas, Supabase, admin |
| [UI_LOGIN_E_IDENTIDADE.md](../../../docs/UI_LOGIN_E_IDENTIDADE.md) | Login, portais, fluxos |
| [CADASTRO_ORGANIZACOES_E_USUARIOS.md](../../../docs/CADASTRO_ORGANIZACOES_E_USUARIOS.md) | Cadastro org, onboarding |
| [SCHEMA_DADOS_V0.md](../../../docs/SCHEMA_DADOS_V0.md) | Modelo de dados |
| [MODULOS_PERMISSOES_E_HUB.md](../../../docs/MODULOS_PERMISSOES_E_HUB.md) | Módulos, permissões |
| `docs/CRM_*.md` | CRM, mapa comercial, templates Hub (abrir o ficheiro concreto no repo) |
| [FLUXO_INICIO_DESENVOLVIMENTO.md](../../../docs/FLUXO_INICIO_DESENVOLVIMENTO.md) | Arranque de dev |
| [TASKS.md](../../../docs/TASKS.md) | Registo de tarefas concluídas, em curso e backlog (atualizar com a skill `projeto-tasks-dashmidias`) |

Se a tarefa for **só governança HUB** (`/adm`, filas admin), usar em conjunto com a skill `hub-governanca-obra10`.

## Viabilidade no código

- Preferir **um** padrão já presente (ex.: `UiFeedbackContext` em vez de `window.alert`; `registrationFormTemplates` + chaves por utilizador).
- Antes de novo ficheiro ou biblioteca, confirmar se não há equivalente em `frontend/src/lib/` ou `modules/`.
- Alterações em Supabase: cruzar com `database/` e com o que já está documentado em `docs/` sobre RLS e tabelas.

## Criar ou atualizar skills

- Para **autor novas skills** no Cursor (estrutura `SKILL.md`, frontmatter YAML, descrição em terceira pessoa, triggers), seguir o guia **create-skill** (fluxo oficial do Cursor).
- Skills **deste repositório** vivem em `.cursor/skills/<nome>/SKILL.md`; não duplicar regras em `docs/` sem necessidade — atualizar `docs/` quando a decisão for de produto ou arquitetura.

## Resposta ao utilizador

- Ser conciso; mencionar **que** documentos foram considerados se a alteração os tocar.
- Se a doc **divergir** do código, assinalar e, se for pedido, propor atualização em `docs/` ou correção no código.

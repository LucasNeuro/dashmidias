---
name: projeto-tasks-dashmidias
description: Obriga o agente a atualizar docs/TASKS.md após entregas relevantes e a manter o registo de concluído, em curso e backlog. Usar em qualquer tarefa de implementação (front, Supabase, rotas, deploy, RLS, UI) quando o utilizador pede registo de progresso, "TASKS", "sempre atualizar TASKS", backlog, roadmap, ou após concluir work que o utilizador considere entregável. Complementa a skill obra10-implementacao-base-docs.
---

# Tarefas do projeto (`docs/TASKS.md`)

## Quando aplicar (triggers)

- O utilizador pede **atualizar**, **registar** ou **não esquecer** o `TASKS.md`, "sempre", progresso, backlog, roadmap, ou cita `/create-skill` com este ficheiro.
- **Fim de sessão** em que o agente **implementou** alterações com impacto: merge na mesma sessão uma entrada em **Concluído** (ver abaixo). **Não** substituir por só "posso atualizar" sem editar, salvo o utilizador **pedir explicitamente** que não toque no `TASKS.md`.
- Tarefa grande só **parcialmente** concluída: mover/actualizar **Em curso** ou acrescentar nota no **Backlog** com referência a ficheiro ou PR.

## Obrigação de registo

1. Se houve entregável (UI, rota, migration, Edge Function, doc de produto no `docs/`, `render.yaml`, etc.), **abrir e editar** [docs/TASKS.md](../../docs/TASKS.md) antes de considerar a tarefa fechada.
2. Uma frase de **Concluído** por lote lógico (vários ficheiros pequenos do mesmo âmbito podem ser **uma** linha com área agregada).
3. Sincronizar com a secção **Histórico (changelog curto)**: uma linha com data e resumo, quando a alteração tiver impacto de produto visível.

## Fluxo (ordem)

1. **Ler** o `TASKS.md` actual antes de editar: não apagar tabelas nem histórico.
2. **Concluído:** linha `| Data | Área | Nota |` com data `AAAA-MM-DD` (preferir a data "Today's date" do contexto da sessão; se ausente, data corrente do calendário), área curta, nota numa frase; pode citar 1–2 caminhos (ex. `frontend/src/...`).
3. **Em curso** / **Backlog:** actualizar só com alinhamento do utilizador, ou propor bullet no Backlog.
4. **Não** colar secrets, tokens, URLs com credenciais.
5. **Não** inflar: "fix typo" isolado → omitir; vários ajustes menores → uma linha "Ajustes menores em …".
6. Se o ficheiro exceder muito o tamanho útil, propor ao utilizador arquivar por período (ex. `docs/TASKS_2026.md`) em vez de apagar concluídos.

## Resposta ao utilizador

- Confirmar em 1–2 bullets **o que** foi adicionado ou actualizado no `TASKS.md`.
- Se a tarefa foi só consulta, resumir o estado das tabelas sem editar (e dizer que não havia registo a acrescentar).

## Make MCP (opcional)

- Se o utilizador quiser **notificar a Make** após o registo no `TASKS.md`: ver [docs/INTEGRACAO_MAKE_MCP_E_TASKS.md](../../docs/INTEGRACAO_MAKE_MCP_E_TASKS.md).
- Com o servidor **make** configurado no `mcp.json` do Cursor e o cenário exposto como tool, após **editar o `TASKS.md`** o agente **pode** invocar a tool de correr o cenário **na mesma conversa** (nomes das tools vêm do painel MCP; não adivinhar). **Não** colar tokens no repositório; usar `${env:MCP_TOKEN}`.
- Se o requisito for **cada commit** em `docs/TASKS.md` no remoto, isso **não** passa por MCP: usar **webhook + CI** (modo B do doc).

## Relação com outras skills

- **obra10-implementacao-base-docs:** antes de implementar, ler `docs/` relevantes; após concluir entrega, **sempre** fechar o ciclo com **este** ficheiro (`TASKS.md`).

---
name: projeto-tasks-dashmidias
description: Garante que o agente regista tarefas concluídas, em curso e backlog no ficheiro docs/TASKS.md do repositório dashmidias. Usar quando o utilizador pede tarefas, backlog, registo de progresso, "TASKS", atualização de roadmap do projeto, ou após concluir entregas que devam ficar documentadas no repositório.
---

# Tarefas do projeto (docs/TASKS.md)

## Quando aplicar

- O utilizador pede lista de tarefas, progresso, backlog, ou criação/manutenção do documento de tarefas.
- Após implementar **qualquer** alteração de código ou doc que o utilizador considere “entregável” (refactor de auth, rota, Supabase, deploy, RLS, UI governança, etc.): oferecer **atualizar** `docs/TASKS.md` na mesma sessão, salvo o utilizador pedir para não tocar.
- Sempre que forem referidos **ficheiros** ou **módulos** concretos, a entrada em `TASKS.md` pode citar 1–2 caminhos (ex. `frontend/src/App.jsx`).

## Fluxo obrigatório (ordem)

1. **Ler** [docs/TASKS.md](../../docs/TASKS.md) antes de o reescrever do zero: preserva histórico e tabela “Concluído”.
2. **Adicionar** (não apagar o histórico):
   - **Concluído:** linha na tabela com data **AAAA-MM-DD** (usar a data de hoje se o repositório não indicar outra), **Área** curta, **Nota** numa frase.
   - **Em curso** ou **Backlog:** só se o utilizador tiver alinhado prioridade; caso contrário propor bullet no backlog.
3. Se secção “Histórico (changelog curto)” existir, **anexar** uma linha com a data e 1 frase de resumo do que entrou/alterou nessa edição.
4. Manter o tom: **português**, tabelas **`|`** como no ficheiro, **sem** duplicar parágrafos de outros docs (linkar a `PLANEJAMENTO.md` / `ACESSOS_…` / schema quando fizer sentido).
5. **Não** inflar o ficheiro: entradas muito pequenas (ex.: “fix typo”) podem ser agregadas numa linha de área (ex. “Ajustes menores de UI”).

## Anti-padrões

- Não substituir o documento por só “lista a fazer” sem tabela concluído.
- Não listar chaves, secrets ou URLs com tokens no `TASKS.md`.
- Não exceder ~300 linhas no `TASKS.md` sem partir para subsecções por trimestre ou ficheiro `docs/TASKS_YYYY.md` (só se o utilizador pedir).

## Resposta ao utilizador

- Mencionar que `docs/TASKS.md` foi atualizado e o que se acrescentou (1–2 bullets).
- Se nada mudou (apenas leitura), resumir o estado atual das tabelas.

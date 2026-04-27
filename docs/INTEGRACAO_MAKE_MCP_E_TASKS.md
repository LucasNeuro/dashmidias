# Integração Make (MCP) + `docs/TASKS.md`

Guia curto: **não** é obrigatório usar a Make para editar o `TASKS.md`. O ficheiro continua a ser **Markdown no Git**; a Make entra se quiseres **automação à volta** de entregas (notificações, folhas, etc.).

---

## 1. Dois modos (escolhe um ou combina)

| Modo | O que dispara a Make | Quando usar |
|------|------------------------|------------|
| **A — MCP no Cursor** | O **agente** chama a tool “correr cenário” da Make **na mesma sessão** em que acabou de actualizar o `TASKS.md`. | Queres feedback imediato no fluxo de desenvolvimento (Chat / Agent) sem depender de git push. |
| **B — Webhook (HTTP) / CI** | **GitHub Actions**, hook de pre-push, ou outro processo que faz **POST** à URL de webhook de um cenário Make quando `docs/TASKS.md` muda. | Queres gatilho **no repositório** (equipa, histórico, qualquer quem dê commit), independente do Cursor. |

- **A** depende de **MCP activo** e do modelo **chamar a tool** (ou de regras que o peçam).
- **B** **não** precisa de MCP: o cenário inicia com o módulo **Webhooks** na Make; o cliente é o teu pipeline.

---

## 2. Ligar a Make ao Cursor

Passo comum: **Cursor (Desktop)** → definições → **Tools & Integrations** (ou **Tools** no plano Free) → **MCP Tools** → **Add Custom MCP** (edita o `mcp.json`). Não comites chaves no repositório; usa variáveis de ambiente (ex. `${env:MAKE_TOOLBOX_KEY}`).

A Make oferece **duas** formas (usa a que o teu ecrã “Model Context Protocol / MCP toolboxes” indicar).

### 2.1 MCP toolbox (URL + toolbox key)

Crias um **MCP toolbox** no produto Make; gera-se um **MCP TOOLBOX URL** e um **TOOLBOX KEY**.

**Exemplo** (substitui pelos teus valores reais; na Make o URL segue o padrão `https://<zona>.make.com/mcp/server/...`):

```json
{
  "mcpServers": {
    "make": {
      "url": "https://eu2.make.com/mcp/server/••••••",
      "headers": {
        "Authorization": "Bearer ${env:MAKE_TOOLBOX_KEY}"
      }
    }
  }
}
```

- **Timeout:** os cenários expostes pelo **MCP toolbox** devem concluir em **até 40 segundos**; acima disso, a ligação pode expirar **sem** devolver outputs ao cliente. Parte a lógica pesada (fila, ramos) ou use **webhook/CI (modo B)** para trabalhos longos.
- **Resolução de problemas:** se aparecer o **ecrã de consentimento OAuth** ao conectar, o **URL** ou a **chave** do toolbox estão provavelmente **incorrectos** (ver guia de troubleshooting da Make).

### 2.2 MCP com token (URL `stateless` por zona)

Alternativa documentada no Developer Hub: [MCP token](https://developers.make.com/mcp-server/connect-using-mcp-token) (perfil Make, zona ex. `eu2.make.com`).

```json
{
  "mcpServers": {
    "make": {
      "url": "https://<MAKE_ZONE>/mcp/stateless",
      "headers": {
        "Authorization": "Bearer ${env:MCP_TOKEN}"
      }
    }
  }
}
```

- Problemas de ligação: a doc da Make sugere trocar o sufixo para `/stream` ou `/sse` conforme o suporte do cliente.
- **Referencias:** [Make MCP Server](https://developers.make.com/mcp-server), [Usage with Cursor (token)](https://developers.make.com/mcp-server/connect-using-mcp-token/usage-with-cursor).

### 2.3 Cenários e inputs/outputs

Em ambos os casos, no Make configura [inputs/outputs do cenário](https://help.make.com/scenario-inputs-and-outputs) para a tool fazer sentido na conversa (ex. resumo da alteração no `TASKS`).

---

## 3. Modo A — O agente, após `TASKS.md`, dispara a Make (MCP)

1. Tens a skill **projeto-tasks-dashmidias** a actualizar o `docs/TASKS.md` como hoje.
2. Com o servidor **make** no `mcp.json`, na mesma resposta, o agente **pode** chamar a ferramenta Make associada a “run scenario” (o nome varia; aparece no painel MCP como tool).
3. **Limites:** o agente só chama a tool se o contexto pedir (ou se escreveres “notifica a Make / corre o cenário X após o TASKS”) e se o **MCP estiver conectado**; commits feitos fora do Cursor **não** disparam o MCP sozinhos.

---

## 4. Modo B — Repositório → Webhook Make (sem MCP)

1. Cenário com primeiro módulo **Webhooks** (Custom webhook) em Make; copia a URL.
2. No GitHub: **Action** com `on.push` e `paths: - 'docs/TASKS.md'` que executa `curl`/`Invoke-WebRequest` com um JSON mínimo (ex. `{ "event": "tasks_updated" }`) para essa URL.
3. O mesmo padrão pode alimentar Slack, e-mail, Notion, etc., dentro do mesmo cenário.

Isto reutiliza a ideia do webhook já mencionada para homologação (`VITE_MAKE_HOMOLOGACAO_WEBHOK_URL` no front); aqui a origem é **CI** em vez do browser.

---

## 5. Resumo

- **MCP** = Cursor ⟷ **API MCP** da Make (o agente usa **tools**).
- **Webhook** = qualquer **HTTP** ⟷ módulo Webhooks do cenário (CI, app, n8n, etc.).
- Para “sempre que o `TASKS` muda no Git”: prefere **Modo B**. Para “acabei de fechar tarefa no Agent e quero a Make a saber **agora**”: **Modo A** com **MCP toolbox** ou **URL stateless** + invocação explícita da tool (limites e timeouts: §2.1 e doc Make).

*Última revisão: inclui “MCP toolbox” (URL + key, 40s) e o modo token; confirmar no Developer Hub / produto Make se os endpoints mudarem.*

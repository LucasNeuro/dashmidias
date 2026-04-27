---
name: hub-admin-ui-sem-jargao-tecnico
description: Garante textos em português (Brasil) nas telas administrativas e de governança do HUB sem expor jargão de implementação. Use ao criar ou editar UI em /adm, sideovers, toasts visíveis ao operador, rótulos de botões, subtítulos de página, empty states e mensagens de ajuda inline. Dispara quando o utilizador pede copy para admin, governança, cadastro público, fluxos, templates, ou quando se menciona evitar explicações técnicas nas telas.
---

# UI administrativa HUB — sem jargão técnico na superfície

## Regra

Em **telas que pessoas usam** (admin, governança, cadastro operacional), **não** mostrar:

- Nomes de variáveis de ambiente (`VITE_*`, chaves de `.env`)
- Referências a ficheiros de configuração (`.env`, `build`, nomes internos de rotas como `/#/...` salvo ser o próprio destino copiável acordado)
- Slugs ou identificadores internos **como explicação** (ex.: «o slug coincide com…») — no máximo rótulos funcionais («Identificador do fluxo») quando o campo já existe no formulário
- Termos de stack crus («JSON», «RLS», «PostgREST») em texto de ajuda **para operadores**; preferir linguagem de negócio ou mensagem de erro acionável

Detalhes técnicos ficam em **documentação** (`docs/`, README), **`.env.example`** comentado, ou consola apenas em desenvolvimento.

## O que fazer

- Títulos e ajudas curtas: o que o utilizador **faz** e **porquê** em linguagem de produto (pt-BR).
- Se for preciso documentar ligação entre «vários fluxos na lista» e «entrada pública», usar frase neutra: *«Pode haver vários fluxos; o link público segue a configuração da equipa.»* — sem citar env vars.
- Erros: mensagem clara + ação (*«tente novamente»*, *«verifique a ligação»*) — detalhe técnico só se o utilizador for explícito (ex.: modo avançado).

## Anti-exemplos (não colocar na UI)

- «O slug coincide com `VITE_REGISTRATION_MASTER_FLOW_SLUG`»
- «Altere o `.env` ou o build»
- «Usa o padrão `ob10-intake` no código»

## Verificação rápida

Antes de concluir alterações em páginas `/adm` ou componentes de governança: percorrer strings visíveis e remover referências a `VITE_`, `.env`, e explicações de pipeline de deploy.

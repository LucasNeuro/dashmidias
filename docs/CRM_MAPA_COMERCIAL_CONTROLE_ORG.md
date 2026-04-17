# Mapa comercial CRM, operação e controlo por organização — Obra10+ HUB

Este documento fixa o **mapa de produto** dos CRMs por segmento, a **fronteira CRM vs operação**, um **modelo de dados comum** de referência, **perfis de acesso** e o **direcionamento** para **controlo de utilizadores e permissões** baseado em **templates** (sem formulários fixos por empresa), com evolução para **organizações** e **administradores HUB**.

**Relacionados:** [MODULOS_PERMISSOES_E_HUB.md](./MODULOS_PERMISSOES_E_HUB.md), [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md), [ACESSOS_AUTH_E_GOVERNANCA.md](./ACESSOS_AUTH_E_GOVERNANCA.md).

---

## 1. Princípio: CRM = venda

**CRM = comercialização (venda).** O CRM **não** controla execução, entrega de obra, andamento de projeto nem produção.

O CRM serve para:

- captar lead  
- qualificar  
- negociar  
- fechar  
- perder  
- medir performance comercial  

Tudo o que vem **depois do fechado** sai do CRM e entra em **módulos operacionais** específicos.

**Regra de ouro:** não misturar **execução** com **venda**.

---

## 2. Módulos CRM gerados

| # | Módulo | Âmbito |
|---|--------|--------|
| 1 | **Governança CRM** | Visão consolidada da operação comercial do HUB (diretoria, dono, gestão) |
| 2 | **CRM Imobiliário** | Venda e locação de imóveis até ao fechamento |
| 3 | **CRM Arquitetura** | Venda de projetos (arquitetura, interiores, etc.) até ao fechamento comercial |
| 4 | **CRM Serviços** | Venda de serviços técnicos/execução até ao fechamento comercial |
| 5 | **CRM Produtos** | Venda direta de itens físicos até ao fechamento comercial |

---

## 3. Governança CRM

**Objetivo:** dar visão consolidada da operação comercial do HUB.

**Usuários principais:** dono, diretoria, gestor comercial, liderança.

**O que precisa responder:** quanto vendeu; quanto está em aberto; qual área converte melhor; onde há gargalo; quem performa melhor; que ações precisam acontecer hoje.

**KPIs principais:** Receita total fechada; pipeline total em aberto; ticket médio; taxa de conversão geral.

**Performance por área** (Imobiliário, Arquitetura, Serviços, Produtos): receita fechada; pipeline aberto; conversão; quantidade de negócios.

**Alertas prioritários (exemplos):** leads sem contato há X dias; propostas paradas há X dias; negócios de alto valor travados; queda de conversão por área.

**Performance de pessoas:** ranking; receita por pessoa; conversão; fechamentos.

**Próximas ações (exemplos):** agendar visita; cobrar proposta; retomar lead; follow-up de alto valor.

**Ações da tela:** filtrar período; exportar; detalhar por área; ranking completo; lista de alertas.

**Fora desta tela:** prazo de execução; fornecedor; medição; obra em andamento; status de entrega (operação).

---

## 4. CRM Imobiliário

**Objetivo:** gerir venda e locação de imóveis até ao fechamento.

**Usuários:** corretor, coordenador comercial, gestor imobiliário.

**Pipeline (exemplo):** Lead entrou → Qualificado → Visita agendada → Proposta enviada → Negociação → Fechado / Perdido.

**Dados do card (exemplos):** cliente; imóvel de interesse; venda vs locação; valor estimado; corretor; origem; último contato; temperatura; tag de prioridade.

**Campos obrigatórios do negócio (referência):** ids de lead, cliente, imóvel; etapa; valor estimado; corretor; origem; status; último contato; próximo passo; observações.

**KPIs do topo (exemplos):** leads no período; valor pipeline; propostas em aberto; fechados no mês; conversão.

**Alertas (exemplos):** proposta sem resposta; lead sem atendimento; visita não confirmada; imóvel com lead parado.

**Ações:** criar lead; mover etapa; detalhe; contacto; visita; proposta; perdido/fechado.

**Integrações desejáveis:** agenda; WhatsApp; e-mail; cadastro de imóvel; origem de média.

**Fora do CRM imobiliário:** reforma; projeto; execução de serviço; entrega de produto (operação).

---

## 5. CRM Arquitetura

**Objetivo:** gerir a venda de projetos de arquitetura, interiores e correlatos até ao fechamento comercial.

**Usuários:** arquiteto comercial, closer, gestor de arquitetura.

**Pipeline (exemplo):** Lead → Diagnóstico → Briefing → Proposta enviada → Negociação → Fechado / Perdido.

**Tipos de projeto (exemplos):** residencial; interiores; comercial; consultoria; estudo preliminar; reforma com projeto.

**Fora do CRM arquitetura:** desenvolvimento técnico; revisões pós-fechamento; cronograma de entrega; compatibilização; execução → **gestão de projeto / operação**.

---

## 6. CRM Serviços

**Objetivo:** gerir a venda de serviços técnicos e de execução até ao fechamento comercial.

**Usuários:** vendedor técnico, closer, gestor de serviços, engenharia comercial.

**Exemplos de serviços:** engenharia; marcenaria; marmoraria; vidraçaria; medições; reforma; instalações; especializados.

**Pipeline (exemplo):** Lead → Qualificação → Orçamento → Proposta enviada → Negociação → Fechado / Perdido.

**Fora do CRM serviços:** execução; prazo de obra; medição operacional; material; fornecedor a executar; checklist de entrega → **módulo operacional de execução**.

---

## 7. CRM Produtos

**Objetivo:** gerir venda direta de itens físicos.

**Usuários:** vendedor; consultor; gestor de loja/categoria.

**Exemplos:** mobiliário; eletrodomésticos; decoração; iluminação; etc.

**Pipeline (exemplo):** Lead → Interesse → Cotação enviada → Pedido confirmado → Pago → Entregue / Perdido.

**Bloco complementar:** estados de entrega e pagamento (no limite do CRM comercial); produtos mais vendidos (categoria, volume, receita).

**Fora do CRM produtos:** logística profunda; montagem operacional; stock fino; separação física interna (podem existir integrações, não obrigatório no CRM puro).

---

## 8. Regras de design e UX (todas as telas CRM)

**Paleta:** alinhada à identidade HUB (verde institucional; destaque controlado; fundo claro; cinzas suaves para divisões).

**Padrão visual:** leitura rápida; poucos blocos; foco em ação; evitar gráfico ornamental; evitar cards redundantes; texto legível; sem excesso de ornamento.

**Interações mínimas desejáveis em cada tela CRM:**

- filtrar por período, origem, responsável, etapa  
- buscar por nome, telefone ou e-mail  
- abrir detalhe (lateral ou modal)  
- registar próxima ação  

---

## 9. Modelo de dados comum (referência entre CRMs)

Entidades lógicas (nomes podem mapear para tabelas `SCHEMA_DADOS_V0` e evoluções):

| Entidade | Campos-chave (referência) |
|----------|---------------------------|
| **Lead** | lead_id, nome, telefone, email, origem, data_criacao, responsável_atual, status_geral |
| **Cliente** | cliente_id, nome, telefone, email, documento, observações, origem_principal |
| **Oportunidade** | oportunidade_id, lead_id, cliente_id, módulo, etapa_atual, valor_estimado, valor_fechado, responsável, último_contato_em, próxima_ação, status, fechado_em, perdido_em, motivo_perda |
| **Atividade** | atividade_id, oportunidade_id, tipo, descrição, responsável, vencimento, concluída, concluída_em |
| **Responsável** | responsável_id, nome, área, perfil, ativo |

---

## 10. Perfis de acesso sugeridos

| Perfil | Capacidades típicas |
|--------|---------------------|
| **Administrador** | vê e edita tudo; exporta; altera responsáveis; filtros globais |
| **Gestor** | módulo completo da sua frente; ranking e alertas; altera pipeline |
| **Comercial** (vendedor, corretor, arquiteto comercial, etc.) | vê/edita oportunidades da sua carteira; atividades; etapas permitidas |
| **Diretoria** | governança e relatórios consolidados; pode ser só leitura |

---

## 11. Regras de negócio importantes

1. **Fechado** pode gerar **operação** noutro módulo (ex.: imobiliário → arquitetura → serviços → produtos).  
2. **Uma mesma pessoa** pode ter **várias oportunidades** em paralelo ou em sequência (LTV / jornada).  
3. **Não misturar execução com venda** (regra de ouro).  
4. Toda oportunidade deve ter **responsável** e **próxima ação**.  
5. Toda **perda** deve permitir **motivo** (análise de conversão).

---

## 12. Fluxo macro de monetização (HUB)

Caminho ideal ilustrativo:

Lead entra → fecha Imobiliário → oportunidade em Arquitetura → em Serviços → em Produtos.

Permite: receita por cliente, jornada completa, LTV.

---

## 13. Controlo de utilizadores, organizações e templates (âmbito produto)

Este bloco alinha o pedido de **granularidade** no **controlo de utilizadores** e **formulários de acesso por organização**, sem depender de **formulários fixos** iguais para todas as empresas.

### 13.1 Problema

- Cada **organização** pode exigir **campos e etapas** diferentes no cadastro e na qualificação.  
- Os dados têm de ser **persistidos no nosso modelo** (Postgres/Supabase) de forma **estruturada e auditável**.  
- **Administradores HUB** precisam de políticas claras; **organizações** precisam, a médio prazo, de **autonomia** dentro dos limites da plataforma.

### 13.2 Direção técnica (não implementação fechada)

| Conceito | Descrição |
|----------|-----------|
| **Template de formulário / pipeline** | Definição versionável (JSON schema ou tabelas `form_template`, `form_field`, `pipeline_stage`) por **contexto** (ex.: onboarding org, cadastro lead, qualificação CRM Imobiliário). |
| **Escopo** | Templates podem ser **globais HUB** ou **por organização** (`organizacao_id`). |
| **Binding a dados** | Campos mapeiam para colunas conhecidas **ou** `jsonb` validado (ex.: `organizacao.perfil_cadastro`, `lead.atributos`) com índices onde fizer sentido. |
| **Permissões** | Matriz **recurso × ação × papel** (HUB vs org): ex. `crm.imobiliario.oportunidade.editar`, `org.membro.convidar`. |
| **UI** | Área **Governança** pode ganhar **sub-abas** (ex.: Utilizadores HUB, Organizações, Templates, Políticas de acesso) sem espalhar tudo pela sidebar. |

### 13.3 O que “completo” significa neste roadmap

1. **HUB:** papéis e permissões auditáveis para admins da plataforma; templates base para novos módulos CRM.  
2. **Org:** ao **cadastrar-se**, herda templates por defeito e pode **personalizar** dentro de limites (campos obrigatórios da plataforma + extensões).  
3. **CRM:** oportunidades e leads respeitam **etapas** definidas por template de segmento **e** políticas da org.  
4. **Auditoria:** eventos de alteração de permissão e de template (alinhado a `domain_events` / logs onde existir).

### 13.4 Fora deste documento (mas ligado)

- Detalhe de **RLS** por tabela: [ACESSOS_AUTH_E_GOVERNANCA.md](./ACESSOS_AUTH_E_GOVERNANCA.md) e evoluções em SQL em `database/`.  
- **Schema** relacional base: [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md).  
- **Módulos e permissões** gerais: [MODULOS_PERMISSOES_E_HUB.md](./MODULOS_PERMISSOES_E_HUB.md).

---

## 14. Changelog deste documento

| Data | Nota |
|------|------|
| 2026-04-13 | Primeira versão: mapa CRM comercial por segmento + fronteira operação + direcção templates/org/permissões. |

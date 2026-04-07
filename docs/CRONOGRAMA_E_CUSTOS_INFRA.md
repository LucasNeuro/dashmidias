# Obra10+ HUB — Custos de infraestrutura e equipe

Documento financeiro do projeto, focado **apenas em custos**.

> Este arquivo não traz cronograma de entregas. O detalhamento de fases e tarefas está nas áreas de Roadmap (Linha do tempo, Catálogo e Kanban).

---

## 1. Premissas de cálculo

- **Horizonte financeiro:** 8 meses (calendário)
- **Equipe (referência):** R$ 10.000,00 / mês
- **Câmbio de referência:** US$ 1,00 = R$ 5,70 (atualizar antes de fechar proposta)
- **Stack base da fase 1:** Supabase + Redis + Render
- **Escala (fase posterior):** Docker + Kubernetes em cloud

---

## 2. Custos de infraestrutura (mensal)

### 2.1 O que mais pesa na conta

1. Compute do Supabase (projetos ativos)
2. Storage (contratos, anexos, evidências)
3. Egress (download/tráfego)
4. Edge/webhooks e integrações
5. Redis gerenciado
6. Hosting da aplicação (Render)
7. Observabilidade e e-mail transacional (quando aplicável)

### 2.2 Faixas por cenário (USD e BRL/mês)

| Cenário | Descrição | Infra (USD/mês) | Infra (BRL/mês, × 5,70) |
|---------|-----------|----------------:|-------------------------:|
| **A** | MVP leve, poucos usuários e pouca mídia | ~40–150 | ~R$ 228–855 |
| **B** | Operação interna com mais orgs e anexos | ~110–280 | ~R$ 627–1.596 |
| **C** | Crescimento moderado com maior uso de mídia/webhooks | ~220–530 | ~R$ 1.254–3.021 |

### 2.3 Composição típica dos extras (ordem de grandeza)

- **Render (hosting):** ~US$ 0–30/mês no início (conforme plano e uso)
- **Observabilidade/logs:** ~US$ 0–20/mês no início
- **E-mail transacional (opcional):** ~US$ 0–50/mês
- **Domínio:** ~US$ 5–15/ano

> Prática recomendada: usar spend caps, monitoramento de consumo e revisão mensal de compute/storage.

---

## 3. Custo da equipe (mão de obra)

Premissa consolidada para orçamento: **R$ 10.000,00/mês por 8 meses**.

<div class="doc-cost-card">

<h3>Resumo financeiro — equipe</h3>
<p>Valores em reais (BRL), sem INSS/impostos adicionais (ajuste conforme regime jurídico da contratação).</p>
<table>
<thead>
<tr><th>Item</th><th>Valor</th></tr>
</thead>
<tbody>
<tr><td>Custo mensal (equipe)</td><td><strong>R$ 10.000,00</strong> / mês</td></tr>
<tr><td>Prazo de totalização financeira</td><td><strong>8 meses</strong></td></tr>
<tr><td class="doc-cost-total">Total estimado de equipe (8 × R$ 10.000)</td><td class="doc-cost-total"><strong>R$ 80.000,00</strong></td></tr>
</tbody>
</table>
</div>

---

## 4. Total geral estimado (equipe + infra no período)

Base: **Equipe = R$ 80.000,00** + Infra estimada por 8 meses.

| Combinação | Equipe (BRL) | Infra no período (8 meses) | **Total estimado (BRL)** |
|------------|-------------:|----------------------------:|-------------------------:|
| **Mínimo** | 80.000 | ~4.300 a 6.500 | **~84.300 a 86.500** |
| **Intermediário** | 80.000 | ~7.000 a 11.000 | **~87.000 a 91.000** |
| **Elevado** | 80.000 | ~14.000 a 19.000 | **~94.000 a 99.000** |

Para proposta conservadora, usar cenário **B** ou **C** de infraestrutura.

---

## 5. Itens fora desta soma (normalmente)

- Impostos/encargos trabalhistas e fiscais da equipe
- Taxas variáveis de PSP/fintech por transação
- Licenças e ferramentas não incluídas na stack base
- SLA e suporte evolutivo pós go-live

---

## 6. Referências

- [ESTIMATIVA_CUSTOS_GERAIS.md](./ESTIMATIVA_CUSTOS_GERAIS.md) — consolidado executivo de orçamento
- [ONNZE_TECNOLOGIA.md](./ONNZE_TECNOLOGIA.md) — papel técnico

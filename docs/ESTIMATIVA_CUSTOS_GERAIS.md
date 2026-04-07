# Obra10+ HUB — Estimativa de custos gerais (mão de obra + infraestrutura)

Documento para **orçamento executivo**: consolida **mão de obra (MO)** e **infraestrutura** até o teto de entrega do escopo. As premissas de custo base estão em [CRONOGRAMA_E_CUSTOS_INFRA.md](./CRONOGRAMA_E_CUSTOS_INFRA.md).

---

## 1. Como usar este documento

1. **MO** — confirme ou substitua os valores da §2 (fixe por mês ou preencha a tabela por papel).
2. **Infra** — escolha o cenário A, B ou C em [CRONOGRAMA_E_CUSTOS_INFRA.md](./CRONOGRAMA_E_CUSTOS_INFRA.md) e multiplique pela **duração em meses** do projeto.
3. **Total** — some MO (período) + infra (período) + itens da §5 (se aplicável).
4. **Atualize** a cotação **USD → BRL** antes de apresentar ao cliente (referência usada nos docs: **US$ 1 ≈ R$ 5,70**).

> Todos os valores são **estimativas / faixas** para planejamento, não proposta fiscal fechada.

---

## 2. Mão de obra (equipe de desenvolvimento e entrega)

### 2.1 Premissa já alinhada ao cronograma do HUB

| Item | Valor |
|------|------:|
| Orçamento mensal de equipe (referência) | **R$ 10.000,00** / mês |
| Prazo teto para totalização MO (calendário) | **8 meses** |
| Detalhe de entregas | ver roadmap nas áreas de produto (Linha do tempo, Catálogo e Kanban) |
| **Total MO no período (8 × R$ 10.000)** | **R$ 80.000,00** |

Detalhamento interno por papel (dev, UX, revisão, etc.) fica **fora deste quadro** — ajuste conforme contratos reais.

### 2.2 Modelo genérico (recalcular com outras taxas)

**Fórmula:** `custo MO no período = (soma dos custos mensais da equipe) × nº de meses até a entrega alvo`

| Papel | FTE (0–1) | Custo mensal (R$) | Observação |
|-------|-----------|-------------------|------------|
| Desenvolvimento full-stack | | | |
| Desenvolvimento / UX parcial | | | pode ser a mesma pessoa |
| Liderança técnica / revisão (opcional) | | | |
| Outros (QA, PM, etc.) | | | |
| **Subtotal equipe / mês** | | **R$ ______** | |
| **× meses (ex.: 8)** | | **R$ ______** | total MO período |

---

## 3. Infraestrutura (cloud, hosting, observabilidade)

### 3.1 Resumo mensal (repetido do cronograma)

| Cenário | Descrição resumida | Total infra **aproximado** (USD/mês) | Total infra **aproximado** (BRL/mês, × 5,70) |
|---------|-------------------|---------------------------------------|---------------------------------------------|
| **A** | MVP leve, poucos usuários, pouca mídia | ~40–150 | ~R$ 228–855 |
| **B** | Operação com mais orgs, anexos e fotos | ~110–280 | ~R$ 627–1.596 |
| **C** | Crescimento, mais storage/egress/webhooks | ~220–530 | ~R$ 1.254–3.021 |

Extras típicos (front, domínio, logs, e-mail): ver [CRONOGRAMA_E_CUSTOS_INFRA.md](./CRONOGRAMA_E_CUSTOS_INFRA.md).

### 3.2 Infra no período do projeto (ordem de grandeza)

Multiplique a faixa mensal escolhida pelo **número de meses** em que **staging/prod pagos** estiverem ativos. Para alinhamento financeiro, use **8 meses** como ordem de grandeza do período.

Exemplos **indicativos** (período ≈ **8 meses**):

| Cenário | Cálculo ilustrativo (BRL) | Faixa **indicativa** infra no período |
|---------|---------------------------|----------------------------------------|
| **A** (média baixa ~R$ 540/mês) | 540 × 8 | ~**R$ 4.300** |
| **A** (média alta ~R$ 800/mês) | 800 × 8 | ~**R$ 6.400** |
| **B** (média ~R$ 1.100/mês) | 1.100 × 8 | ~**R$ 8.800** |
| **C** (média ~R$ 2.100/mês) | 2.100 × 8 | ~**R$ 16.800** |

Ajuste se o projeto **ligar produção mais cedo** (infra por mais meses) ou **mantiver compute maior** em staging.

---

## 4. Total geral (MO + infra) — visão consolidada

Base: **MO = R$ 80.000** (8 meses × R$ 10.000). Some a estimativa da §3.2 conforme o cenário.

| Combinação | MO (BRL) | Infra período (ordem de grandeza) | **Total indicativo (BRL)** |
|------------|----------|-----------------------------------|----------------------------|
| Mínimo | 80.000 | + ~4.300 a 6.500 (cenário A) | **~R$ 84.300 a 86.500** |
| Intermediário | 80.000 | + ~7.000 a 11.000 (A alto / B baixo) | **~R$ 87.000 a 91.000** |
| Elevado | 80.000 | + ~14.000 a 19.000 (B/C) | **~R$ 94.000 a 99.000** |

Para apresentação **conservadora**, use **MO R$ 80.000** + **infra cenário B ou C** no período (e revê faixas com a equipa).

---

## 5. Itens que normalmente ficam fora desta soma

- **Impostos e encargos** sobre MO (PJ, CLT, nota fiscal) — conforme regime.
- **Taxas variáveis** de PSP / fintech (percentual por transação).
- **Domínios premium**, ferramentas de design, licenças não incluídas no stack base.
- **Suporte evolutivo** e **SLA** pós go-live (horas/mês ou pacote à parte).

---

## 6. Referências

- [CRONOGRAMA_E_CUSTOS_INFRA.md](./CRONOGRAMA_E_CUSTOS_INFRA.md) — premissas e faixas de custo.
- [PLANEJAMENTO.md](./PLANEJAMENTO.md) — fases de produto.
- [ONNZE_TECNOLOGIA.md](./ONNZE_TECNOLOGIA.md) — papel técnico no HUB.

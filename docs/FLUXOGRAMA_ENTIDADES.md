# Fluxogramas — entidades Obra10+ HUB

Diagramas em [Mermaid](https://mermaid.js.org/) alinhados ao [SPEC.md](./SPEC.md), [MODULOS_PERMISSOES_E_HUB.md](./MODULOS_PERMISSOES_E_HUB.md) e [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md). O **Negócio** (`ID_NEGOCIO`) é o **aggregate root** comercial; demais entidades orbitam ou se vinculam a ele.

**Como visualizar:** preview Markdown no VS Code/Cursor com extensão Mermaid, ou [mermaid.live](https://mermaid.live).

---

## 1. Visão geral: Negócio no centro

```mermaid
flowchart TB
  subgraph entrada["Entradas que alimentam ou criam Negócio"]
    L[Lead / oportunidade]
    I[Imóvel]
    S[Serviço / produto como gatilho]
    T[Tráfego / formulário / manual / WhatsApp]
  end

  N[("NEGÓCIO<br/>ID_NEGOCIO")]

  entrada --> N

  subgraph satelites["Entidades satélites — mesmo ID_NEGOCIO quando mesma jornada"]
    P[Pipeline / estágios]
    IM[Imóvel]
    PR[Projeto]
    O[Obra / execução]
    F[Fornecedor — vínculos]
    PD[Produto]
    SV[Serviço]
    C[Contrato / aditivo / anexo]
    A[Avanço / entrega]
    PG[Pagamento]
    PV[Pós-venda]
  end

  N --- P
  N --- IM
  N --- PR
  N --- O
  N --- F
  N --- PD
  N --- SV
  N --- C
  N --- A
  N --- PG
  N --- PV

  E[(domain_events)]
  N --> E
```

---

## 2. Modelo entidade–relação (core + multi-tenant)

Conceitual: uma **organização** (tenant) isola dados; **pessoa** e **empresa** são atores e partes no ecossistema.

```mermaid
erDiagram
  ORGANIZACAO ||--o{ NEGOCIO : "contém"
  ORGANIZACAO ||--o{ EMPRESA : "cadastra"
  ORGANIZACAO ||--o{ PESSOA : "cadastra"

  NEGOCIO ||--o{ PIPELINE_MOVIMENTO : "estágios"
  NEGOCIO }o--o{ PESSOA : "contatos_interessados"
  NEGOCIO }o--o{ EMPRESA : "partes"
  NEGOCIO }o--o{ IMOVEL : "N_para_N"
  NEGOCIO ||--o{ PROJETO : "desdobra"
  NEGOCIO ||--o{ OBRA_EXECUCAO : "desdobra"
  NEGOCIO }o--o{ FORNECEDOR : "rede"
  NEGOCIO }o--o{ PRODUTO : "linha_comercial"
  NEGOCIO }o--o{ SERVICO : "linha_comercial"
  NEGOCIO ||--o{ CONTRATO : "formaliza"
  NEGOCIO ||--o{ AVANCO_ENTREGA : "marcos_evidências"
  NEGOCIO ||--o{ PAGAMENTO : "fluxo_financeiro"
  NEGOCIO ||--o{ POS_VENDA : "pós_fechamento"
  NEGOCIO ||--o{ DOMAIN_EVENT : "fatos_registrados"

  PROJETO ||--o{ AVANCO_ENTREGA : "entregáveis_arquitetura"
  OBRA_EXECUCAO ||--o{ AVANCO_ENTREGA : "marcos_obra"
  CONTRATO ||--o{ CONTRATO : "aditivos"
```

> **Nota:** `PIPELINE_MOVIMENTO` representa o negócio percorrendo estágios (equivalente conceitual a `pipeline` + histórico). Nomes físicos de tabelas podem diferir do schema v0.

---

## 3. Fluxo: de cadastro à consolidação (entidades em movimento)

Espelha o fluxo principal do SPEC (entradas → CRM → desdobramento → contratos → acompanhamento → financeiro → dados).

```mermaid
flowchart LR
  subgraph E1["1. Entrada"]
    e1a[Pessoa / Empresa]
    e1b[Lead Oportunidade Imóvel Serviço Produto]
  end

  subgraph E2["2. Negócio + Pipeline"]
    N[Negócio]
    PL[Pipeline]
  end

  subgraph E3["3. Desdobramento"]
    IM[Imóvel]
    PR[Projeto]
    OB[Obra]
    FO[Fornecedor]
    PD[Produto]
    SV[Serviço]
  end

  subgraph E4["4. Formalização"]
    CT[Contrato aditivos anexos]
  end

  subgraph E5["5. Execução"]
    AV[Avanço entrega]
  end

  subgraph E6["6. Dinheiro"]
    PG[Pagamento escrow multisplit]
  end

  subgraph E7["7. Pós e dados"]
    PV[Pós-venda]
    DE[domain_events / analytics]
  end

  E1 --> E2
  E2 --> E3
  E3 --> E4
  E4 --> E5
  E5 --> E6
  E6 --> E7
  E5 -.->|CRM não morre| PV
  N --- PL
  N --- IM
  N --- PR
  N --- OB
  N --- FO
  N --- PD
  N --- SV
  N --- CT
  N --- AV
  N --- PG
  N --- PV
  N --> DE
```

---

## 4. Fluxo por entidade (ciclo de vida resumido)

### 4.1 Pessoa

```mermaid
flowchart TD
  A[Cadastro da pessoa] --> B{Vínculos}
  B --> C[Contato em Negócio]
  B --> D[Usuário Auth opcional]
  B --> E[Cliente final no portal]
  B --> F[Membro de Empresa]
```

### 4.2 Empresa

```mermaid
flowchart TD
  A[Cadastro empresa] --> B{Tipo de uso}
  B --> C[Imobiliária parceira / corretagem]
  B --> D[Escritório arquitetura]
  B --> E[Engenharia executora]
  B --> F[Fornecedor homologável]
  B --> G[Parte em Negócio]
```

### 4.3 Negócio

```mermaid
flowchart TD
  A[Criação ou promoção de lead] --> B[Qualificação]
  B --> C[Pipeline]
  C --> D[Proposta negociação]
  D --> E{Fechamento}
  E -->|Sim| F[Desdobramentos operacionais]
  E -->|Não| G[Arquivamento ou reativação]
  F --> H[Pós-venda e novos ciclos]
```

### 4.4 Pipeline

```mermaid
flowchart LR
  S1[Estágio N] -->|evento + responsável| S2[Estágio N+1]
  S2 --> S3[...]
  S3 --> SF[Fechado / perdido]
```

### 4.5 Imóvel

```mermaid
flowchart TD
  A[Cadastro imóvel] --> B[Base / portal]
  B --> C[Interessados / leads]
  C --> D[Vínculo a Negócio]
  D --> E[Venda ou arquivo]
```

### 4.6 Projeto (arquitetura)

```mermaid
flowchart TD
  A[Projeto vinculado ao Negócio] --> B[Cronograma]
  B --> C[Entregáveis]
  C --> D[Avanço / entrega]
  D --> E[Transição para obra / fornecedores]
```

### 4.7 Obra / execução

```mermaid
flowchart TD
  A[Obra vinculada ao Negócio] --> B[Cronograma obra]
  B --> C[Diário relatórios fotos]
  C --> D[Equipe compras]
  D --> E[Avanço / entrega]
  E --> F[Dados consolidados HUB / auditoria]
```

### 4.8 Fornecedor

```mermaid
flowchart TD
  A[Cadastro autônomo] --> B[Documentos especialidades equipe]
  B --> C[Homologação]
  C --> D[Vínculo a Negócio Projeto Obra]
  D --> E[Performance]
```

### 4.9 Produto e Serviço (catálogo + instância comercial)

```mermaid
flowchart TD
  A[Catálogo Produto ou Serviço] --> B[Uso em proposta / negócio]
  B --> C[Contrato / entrega]
  C --> D[Pagamento / split se aplicável]
```

### 4.10 Contrato

```mermaid
flowchart TD
  A[Rascunho vinculado ao Negócio] --> B[Assinatura interna ou externa]
  B --> C[Registro metadados estado]
  C --> D[Aditivos anexos]
  D --> E[Evento CONTRATO_ASSINADO / ADITIVO]
```

### 4.11 Avanço / entrega

```mermaid
flowchart TD
  A[Marco ou entregável] --> B[Evidências]
  B --> C[Responsável data hora]
  C --> D[Evento ETAPA_CONCLUIDA / RELATORIO_ENVIADO]
  D --> E[Relatórios e auditoria]
```

### 4.12 Pagamento

```mermaid
flowchart TD
  A[Registro intenção / recebimento] --> B{Escrow}
  B -->|Retido| C[Condições e regras]
  C --> D[Multisplit]
  D --> E[Liberação]
  B -->|Direto| D
  E --> F[Eventos PAGAMENTO_*]
```

### 4.13 Pós-venda

```mermaid
flowchart TD
  A[Pós-fechamento] --> B[Casos contato satisfação]
  B --> C[Novas oportunidades mesmo cliente]
  C --> D[Retorno ao CRM / Negócio]
```

---

## 5. Mapa rápido: entidade → principais vínculos

| Entidade | Vínculos típicos |
|----------|------------------|
| **Pessoa** | Negócio, Empresa, usuário Auth, portal cliente |
| **Empresa** | Organização, Negócio, tipo imobiliária/arquitetura/fornecedor |
| **Negócio** | Todos os demais (eixo); `organizacao_id` |
| **Pipeline** | Negócio, estágios, histórico, eventos de movimentação |
| **Imóvel** | Negócio, interessados, imobiliária/corretor |
| **Projeto** | Negócio, entregáveis, avanços, fornecedores |
| **Obra** | Negócio, diário, fotos, equipe, compras |
| **Fornecedor** | Negócio, projeto, obra, homologação |
| **Produto** | Negócio, contrato, pagamento |
| **Serviço** | Negócio, obra, fornecedor, contrato |
| **Contrato** | Negócio, aditivos, Storage, assinatura externa |
| **Avanço/entrega** | Projeto, obra, relatório, evidências |
| **Pagamento** | Negócio, escrow, split, regras |
| **Pós-venda** | Negócio, pessoa, CRM contínuo |

---

## Documentos relacionados

| Documento | Uso |
|-----------|-----|
| [FLUXOGRAMA_FEATURES.md](./FLUXOGRAMA_FEATURES.md) | Funcionalidades e fluxos por módulo |
| [SPEC.md](./SPEC.md) | Definição canônica de entidades e regras |
| [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md) | Tabelas e colunas iniciais |

---

*Evoluir este arquivo quando novas entidades (ex.: proposta formalizada, proposta_comercial) forem introduzidas no schema.*

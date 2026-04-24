# Estrutura de códigos identificadores (HUB Obra 10+)

Este documento espelha o **padrão de identificação** descrito na especificação técnica do HUB Obra 10+ e acrescenta o código interno de **organização** usado no dashmidias para rastreio e suporte.

**Fonte externa (referência de produto):** [HUB Obra 10+ — Especificação Técnica](https://hubobra10-loca8vun.manus.space/#estrutura) (secção «Estrutura de códigos»).

---

## 1. Princípios (especificação)

- Formato geral: `PREFIXO-ANO-NÚMERO` (ou variantes com mercado/tipo no meio).
- **Imutabilidade:** códigos de negócio não devem ser alterados após criação.
- **Sem estado no código:** status vive em colunas/atributos, não embutido no identificador.
- O mercado/prefixo indica a **origem** da demanda; não limita evolução futura.

---

## 2. Negócio e oportunidade (CRM)

| Entidade | Padrão | Exemplo |
|----------|--------|---------|
| Negócio | `NEG-[MERCADO]-ANO-NÚMERO` | `NEG-IMB-2026-001` |
| Oportunidade | `OPP-[TIPO]-ANO-NÚMERO` | `OPP-ARQ-2026-002` |

### Prefixos de mercado (demanda)

| Código | Mercado |
|--------|---------|
| `IMB` | Imobiliário |
| `ARQ` | Arquitetura |
| `SRV` | Serviços |
| `PRO` | Produtos |

---

## 3. Outros prefixos citados na especificação

Exemplos de prefixos para entidades ao longo do ecossistema (lead, pessoa, cliente, imóvel, papéis, etc.): `LEAD`, `PES`, `CLT`, `EMP`, `IMO`, `COR`, `ARQ`, `ENG`, `FOR`, `PRO` — ver tabela completa no site acima.

---

## 4. Organização (tenant) — implementação dashmidias

Para **rastreio interno** e alinhamento com o padrão comercial (**OPP**), cada linha em `organizacoes` pode ter `codigo_rastreio` gerado ao submeter o cadastro público (e reutilizado na aprovação):

- **Formato:** `HUB-OPP-{MERCADO}-{DATA UTC}-{SUFIXO}`
- **MERCADO:** `IMB` | `ARQ` | `SRV` | `PRO`, derivado de `partner_kind` / `tipo_organizacao` (função `hub_partner_kind_to_org_prefix`).
- **DATA:** oito dígitos `YYYYMMDD` (UTC).
- **SUFIXO:** oito caracteres hexadecimais (aleatório; regerado em caso de colisão).

Exemplo (arquitetura): `HUB-OPP-ARQ-20260424-A1B2C3D4`.

Códigos **legados** `ORG-*` podem permanecer em linhas antigas; novos pedidos usam apenas `HUB-OPP-*`.

**Nota:** identificador de **organização (tenant)**; não substitui `NEG-*` / `OPP-*` dos negócios no CRM.

---

## 5. Relação com o fluxo de cadastro público

1. O formulário `/cadastro/organizacao` grava `hub_partner_org_signups` com `cnpja_snapshot` = **payload completo** da consulta CNPJ (CNPJA ou Brasil API) e `consulta_fonte`.
2. O administrador HUB revê o snapshot na governança (**Organizações**), escolhe **módulos** e **tipo de organização**, e chama a RPC `hub_approve_partner_org_signup`.
3. A RPC cria a organização (com `codigo_rastreio`), aplica `organizacao_modulos`, cria `organizacao_convites` e devolve o token do convite (mostrado uma vez na UI).

Detalhes de papéis e tabelas: [CADASTRO_ORGANIZACOES_E_USUARIOS.md](./CADASTRO_ORGANIZACOES_E_USUARIOS.md).

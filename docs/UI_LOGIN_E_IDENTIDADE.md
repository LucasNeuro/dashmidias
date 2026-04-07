# UI — Login e identidade visual (Obra10+ HUB)

Este guia alinha **telas de autenticação** e **shell do produto** à mesma linguagem: **predominância de branco**, texto **charcoal**, **dourado da marca** só onde precisa destacar (CTA, estados ativos, detalhes). Referências de mercado analisadas: estética tipo **Praxio** / **integra.sky** (marketplace, split login, cards) e **ClicVend** (CRM + lista + top bar) — **não copiar cores alheias** (laranja, teal, roxo); traduzir o **padrão** para a paleta Obra10+ abaixo.

---

## 1. Paleta Obra10+ (tokens)

| Token | Hex | Uso |
|-------|-----|-----|
| `--obra-bg` | `#FFFFFF` | Fundo principal (login formulário, área de trabalho) |
| `--obra-surface` | `#FAFAFA` | Fundo secundário, sidebar clara, cards sobre branco |
| `--obra-text` | `#1A1A1A` | Títulos e corpo em superfície clara |
| `--obra-text-muted` | `#5C5C5C` | Legendas, placeholders, texto secundário |
| `--obra-border` | `#E5E5E5` | Bordas de inputs, divisores leves |
| `--obra-accent` | `#C5A059` | Botão primário, link de destaque, foco visível, item ativo (detalhe) |
| `--obra-accent-hover` | `#B8924A` | Hover do primário (ajustar contraste em QA) |
| `--obra-ink-dark` | `#1A1A1A` | Painel escuro (split login, hero strip, sidebar escura opcional) |
| `--obra-text-on-dark` | `#E8E8E8` | Texto sobre `--obra-ink-dark` |
| `--obra-highlight` | `#FFFFFF` | Destaque pontual no logo (ex.: “10+” sobre faixa escura) |

**Regra:** o dourado **não** pinta fundos grandes no login; no máximo **botão**, **link**, **linha fina** (1px) ou **borda do input em foco**.

---

## 2. Login — padrão recomendado (referência: integra.sky)

**Split screen** equilibra marca e conversão:

| Lado | Conteúdo | Estilo Obra10+ |
|------|----------|----------------|
| **Esquerda (~40–45%)** | Logo Obra10+, slogan curto (ex.: “Uma plataforma para o ecossistema do HUB”), ilustração geométrica ou pattern sutil | Fundo `#1A1A1A`; texto `#E8E8E8`; detalhes geométricos em **dourado** + branco (como o slide de marca) |
| **Direita** | Formulário | Fundo `#FFFFFF` ou `#FAFAFA`; título em `#1A1A1A` |

**Formulário:**

- Campos: borda `#E5E5E5`, cantos **8px**, altura confortável (min 44px altura tocável).
- **Botão “Entrar”:** fundo `#C5A059`, texto branco ou `#1A1A1A` conforme contraste WCAG no teste final.
- Links (“Esqueci a senha”, “Criar conta”): texto `#1A1A1A` com sublinhado ou cor dourada **só no hover** — evitar três cores competindo.
- Checkbox “Lembrar-me”: alinhado à esquerda; link “Esqueci” à direita na mesma linha (padrão integra.sky).

**Mobile:** empilhar — painel de marca compacto no topo (altura ~180–220px) + formulário abaixo em branco.

---

## 3. Login — alternativa (referência: Praxio / card central)

- Fundo `#FAFAFA` ou branco com **card** branco centrado, sombra **suave** (ex.: `0 1px 3px rgba(26,26,26,0.08)`).
- Opcional: **faixa superior** estreita ou **hero** baixo em `#1A1A1A` com título em `#E8E8E8` e CTA secundário dourado — eco do banner “Marketplace” do Praxio, sem laranja.
- Logo Obra10+ acima do card.

Útil quando não houver ilustração pronta.

---

## 4. Após o login — continuidade visual (referência: Praxio + ClicVend)

Para não “parecer outro site” depois do login:

| Elemento | Diretriz |
|----------|----------|
| **Shell** | Sidebar **clara** `#FAFAFA` + conteúdo `#FFFFFF` **ou** sidebar **escura** `#1A1A1A` com texto `#E8E8E8` e **item ativo** com barra lateral ou texto `#C5A059` (similar a Linear / Praxio, sem teal). |
| **Top bar** | Se usar barra escura (estilo ClicVend), usar **`#1A1A1A`**, não verde/azul de terceiros. Logo com “Obra” dourado + “10+” branco onde couber. |
| **Cards / grid** | Como Praxio: cards brancos, borda sutil, **cantos 8–12px**, badges de status neutros (cinza/verde semântico para “ativo”). |
| **Lista + detalhe** | Como ClicVend: lista à esquerda em superfície clara; área principal branca; tags de status com **uma** cor de destaque consistente (pode ser dourado suave ou cinza + semântica). |

---

## 5. Tipografia e ícones

- **Sans-serif** moderna, legível (corpo e UI); pesos **regular / medium / semibold** — alinhado ao material de marca Obra10+.
- Tamanhos mínimos: ~14–16px corpo em formulários; título da página de login **24–28px**.
- Ícones: traço fino, cor `#5C5C5C` inativo; ativo pode ser `#1A1A1A` ou `#C5A059`.

---

## 6. Acessibilidade (não negociável)

- Contraste texto/fundo nos estados finais (ferramenta de check).
- **Foco de teclado** visível (anel ou borda usando dourado ou contorno escuro).
- Mensagens de erro abaixo do campo, texto claro; não só cor vermelha.

---

## 7. Resumo

- **Login** = mesma identidade do HUB: branco + charcoal + dourado em **detalhe e CTA**.
- **Referências de mercado** informam **layout** (split, card, banner, CRM em três colunas), não a paleta alheia.
- **Pós-login** deve repetir tokens para sensação de produto único.

---

## Documentos relacionados

- [SPEC.md](./SPEC.md) — perfis, módulos, cliente final com UX simples (login/admin pode ser mais denso; portal cliente pode usar variante ainda mais minimalista do mesmo tema).

---

*Evolutivo: quando o design system em código existir, duplicar estes tokens em `:root` ou tema do framework e manter este arquivo como contrato de produto.*

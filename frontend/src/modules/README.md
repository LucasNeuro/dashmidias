# Módulos do frontend

| Pasta | Escopo |
|--------|--------|
| **`campaigns-dashboard/`** | Painel de performance (Meta/Google, relatórios, filtros). Independente do núcleo HUB. Rota sugerida: `/painel/campanhas`. |
| **`hub-core/`** | Obra10+ HUB: organizações, negócios, pipeline, `domain_events`, conforme `docs/`. Rota sugerida: `/app` ou `/hub`. |

Código compartilhado (Auth, Supabase client, format) permanece em `src/lib`, `src/context`, `src/components` quando for transversal.

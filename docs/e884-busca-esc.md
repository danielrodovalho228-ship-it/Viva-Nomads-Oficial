# E884 — Esc fecha as sugestões da busca da home

**Defeito:** a busca da home (`BuscaPrincipal` → `CityAutocomplete`) só fechava a lista de sugestões no clique fora ou ao escolher uma cidade; Esc não fazia nada.

**Correção:** `CityAutocomplete` ganha `onKeyDown` no campo: com a lista aberta, Esc fecha e consome a tecla (`preventDefault`); com ela fechada, Esc segue o comportamento normal do navegador. A regra fica em `src/lib/busca/sugestoes-teclado.ts` (`abertoAposTecla`). Digitar de novo reabre a lista (o `onChange` já faz `setOpen(true)`).

Vale para todo lugar que usa `CityAutocomplete` (home e demais formulários com campo de cidade).

**Teste:** `src/lib/busca/sugestoes-teclado.test.ts` (regra + ligação no componente); vermelho na main, verde na branch.

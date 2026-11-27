# E901 — /fale-com-a-viva vai para /ajuda/fale-com-a-viva

**Defeito:** `/fale-com-a-viva` respondia 404. A página mora em `/ajuda/fale-com-a-viva`.

**Correção:** redirect permanente (308) em `next.config.ts`, ao lado do `/contato → /ajuda`. Âmbito fechado: só o redirect, nenhum link interno a corrigir.

**Teste:** `src/config/e901-fale-com-a-viva-redirect.test.ts`, que usa o casador de rotas do Next sobre `redirects()`. Na main falha 1 de 2; na branch passam 2 de 2.

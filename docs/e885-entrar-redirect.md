# E885 — /entrar vai para /auth

**Defeito:** `/entrar` não existe como rota e respondia 404 (página de "não encontrado"), embora seja o endereço natural de quem quer entrar.

**Correção:** redirect em `next.config.ts` — `{ source: "/entrar", destination: "/auth", permanent: true }` (308), junto dos outros "endereços naturais" que davam 404. A query segue junto (ex.: `/entrar?redirect=/dashboard` → `/auth?redirect=/dashboard`, que a tela de entrada já honra via `safeInternalPath`).

**Teste:** `src/config/e885-entrar-redirect.test.ts` (casador de rotas do próprio Next sobre `redirects()`); vermelho na main (1 falha), verde na branch.

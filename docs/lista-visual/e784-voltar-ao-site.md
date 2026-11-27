# E784 — "‹ Voltar ao site" do admin (09/11/2026)

- **Causa:** o link do admin no celular era fixo (`<Link href="/">`) e não sabia de onde a pessoa veio. O site não guardava a última página pública, então o destino nunca acompanhava o contexto (o Daniel foi parar numa página de busca e perdeu onde estava).
- **Correção:** `RastroPublico` (no layout público) grava a rota pública a cada troca de página em `sessionStorage`; `VoltarAoSite` (no admin) lê e leva a ela. Nada guardado (entrada direta no admin) → home. Só rotas públicas valem (nunca `/dashboard`, `/admin`, `/auth`, `/api` nem URL de outro site). `/buscar` só aparece se foi a página anterior.
- **Três caminhos (390 px), cobertos no teste determinístico `ultima-publica.test.ts`:** (1) vindo de um anúncio → o mesmo anúncio (com a query); (2) vindo da home → home; (3) entrada direta → home.
- **Prova no navegador:** o admin exige conta de equipe, que o ambiente local não tem; o QA prova os três caminhos no celular. O spec de laboratório do `t404` continua valendo (entrada direta → `href="/"`); um spec dos três caminhos fica para a Pista C.

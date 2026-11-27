# E760 — /dashboard/meus-imoveis dava 404

Achado (Phoenix, RELATORIO-005, C2): a rota antiga `/dashboard/meus-imoveis` respondia "Página não encontrada". A lista de anúncios de hoje é `/dashboard/imoveis` (menu Anúncios).

- `next.config.ts`: redirect temporário (sem 308, para não ficar em cache) de `/dashboard/meus-imoveis` e `/dashboard/meus-imoveis/:path*` para `/dashboard/imoveis` e `/dashboard/imoveis/:path*`.
- Varredura: nenhum link interno, e-mail, texto ou migração do repositório aponta para a rota antiga (só links externos/antigos de quem a guardou), então não houve o que trocar.
- Guarda: `src/lib/e760-meus-imoveis-redirect.test.ts` (redirect presente, destino existe, nenhuma página antiga, nenhuma referência nova em `src` e `supabase`).

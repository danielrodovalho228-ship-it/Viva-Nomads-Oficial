# E720 — "← Voltar" nas telas internas do painel (Pista A)

Achado do Daniel (08/11/2026): Avaliações e Pedidos abriam direto no título, sem o voltar que o Perfil tem.

**Correção:** `VoltarPainel` (casca do painel, `dashboard-shell.tsx`) mostra o mesmo "← Voltar" no topo do conteúdo de toda tela interna, no celular e no computador. Volta para onde a pessoa estava; aberta direto, vai ao início do painel. Regra em `src/lib/navegacao/voltar-painel.ts` (testada).

**Fora da regra (já têm voltar próprio):** início do painel; telas da Conta (`CascaConta`, exceto o menu `/dashboard/conta`, que ganhou); notificações; verificação; fechamento; filhas de estadia/visitas/contratos/interessados; cadastro de imóvel; editar imóvel; nova proposta; avaliação de parceiro; páginas de teste `/dashboard/qa`.

**Varredura 390 e 1280 px (demo):** 33 rotas listadas; 29 sem voltar passaram a ter exatamente 1; nenhuma ficou com dois. `/dashboard/avaliacoes` redireciona o demo ao login (precisa de dados reais), mas usa a mesma casca. Capturas de Pedidos em `docs/capturas/e720/`.

# Entrega da Pista A ao QA — fila visual (09/11/2026)

Todos os PRs abaixo estão em **draft**, sem conflito com a `main` (checado com `git merge-tree`) e com `verify`, `lab-critico` e `e2e` verdes (o #3613 foi reexecutado depois de receber o mesmo ajuste de teste do #3598). Nenhum tem migração. A `main` está vermelha por dois testes (E727/E728); o conserto é o **#3598** (Pista B, verde, fora de draft): ao entrar, o ajuste de teste idêntico que levei para os PRs abaixo se unifica sozinho.

| PR | Item | O que entrega | Prova pendente (QA, não executada pela Pista A) |
|---|---|---|---|
| #3611 | E780 | Faixa de filtros do topo da /buscar presa abaixo do cabeçalho (chips inteiros, ações sem deslocamento) | 390 px, print × mockup BUSCA-CARD: rolar a página e conferir chips inteiros e quietos; painel "Mais filtros" cabe na tela |
| #3610 | E781 | Abas do detalhe rolam por código até a seção, com compensação do cabeçalho, e conferem depois do carregamento | 390 px, aba por aba, num anúncio de exemplo e num real; no aparelho do Daniel (iOS/Safari) |
| #3617 | E782 (+ adendo "Uberlândia") | Avaliações: seta junto do título, título em tinta, abas sublinhadas, sem título duplicado; cidade com acento nos papéis | 390 px logado, print de referência ("Como você usa a Viva") e mockup `avaliacoes-painel` lado a lado; decidir pílulas × sublinhado se o mockup mandar pílulas |
| #3618 | E783 | Foto do cabeçalho em todas as rotas (revoga a exceção do E55); iniciais só sem foto | Logado, 390 px, nas telas principais: Conta, Perfil, papéis, painel, mensagens |
| #3620 | E784 | "Voltar ao site" do admin leva à última página pública; entrada direta → home | **Três caminhos no celular (390 px):** (1) entra no admin vindo de um anúncio → volta ao mesmo anúncio; (2) vindo da home → home; (3) entrada direta → home. Spec de lab dos 3 caminhos: sugerido à Pista C |
| #3599 | E777 | "R$ X em N meses" em uma função só (`resumoEmMeses`) | Conferência visual dos totais no cartão, barra fixa, reserva e cartão lateral (sem mudança de valores) |
| #3613 | E774 | Home (passo "Converse"), /como-funciona, anúncio e /pedidos/novo não prometem mais contato depois do aceite (regra E445) | Ler as superfícies a 390 px; decisão do Daniel sobre as irmãs abaixo |

## E774 — irmãs que ainda dizem "contato só depois do aceite" (NÃO alteradas: outro fluxo, decisão do Daniel)
- Fluxo dos **parceiros de serviço** (`CONTATO_APOS_ACEITE` em `lib/parceiros/regras.ts`, /parceiros/[slug], /parceiros/buscar, pedidos de serviço): a regra do item 16 libera telefone e e-mail da outra parte depois do aceite do orçamento.
- **Visitas do dono** (`/dashboard/visitas`): "Nome e contato do interessado só aparecem depois do aceite".
- Fotógrafos: "contato do dono só depois do aceite, com taxa paga".
Se o E445 vale para esses fluxos, abrir item novo; a Pista A não alterou sem ordem.

## Pendências de decisão (registradas antes)
E761 (identidade bloqueia ou não), E762 (mostrar líquido × guarda de custódia), BannerTopo × ordem 5a4b9146, `Total por mês (com contas)` em `precos.ts` (E767, intocada), prazo de resposta de empresas (E770), cartões de /seguranca (C10-2).

## Regras seguidas
Sem migração, sem prova ao vivo, sem merge, sem push na `main`.

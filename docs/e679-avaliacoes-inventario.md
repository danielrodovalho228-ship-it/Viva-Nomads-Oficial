# E679 — Sistema de avaliações, parte visual (Pista A): inventário e bloqueio (07/11/2026)

## Bloqueio de entrada
Os 16 mockups aprovados (`avaliacoes-*.webp`, 8 telas × desktop/mobile) e o estudo `estudo-avaliacoes-coordenador-07-11.md` **não estão acessíveis a esta sessão**: não existe `mockups/` na `main` nem em nenhum dos ramos remotos (busca por `mockups/avaliacoes*` no histórico: vazia), não há cópia no container e o Drive não os acha. Sem eles não dá para entregar "igual ao mockup" (cores, formatos, proporções, espaçamentos, tipografia, estados) nem escolher a rota canônica do painel unificado. **Pedido:** commitar os 16 `.webp` em `mockups/` (ou em `docs/mockups/avaliacoes/`) numa branch/PR e avisar o caminho; o estudo, em `docs/`.

## O que já existe (mapa do código)
| Tela do despacho | Hoje | Lacuna vs. o desenho descrito |
|---|---|---|
| 1–2. Avaliar estadia (morador ↔ proprietário) | `components/avaliacao-form.tsx` (usado em `locacoes-client` e `contratos-client`), regras em `lib/avaliacoes.ts`, ação `lib/data/avaliacoes-actions.ts` | Só **nota geral (1–5 estrelas) + comentário público (500)**. Faltam: os **3 critérios em estrelas por par**, **etiquetas rápidas**, "recomendaria/receberia de novo", **nota privada para a outra parte** e **para a Viva** (o limite de 500 já cobre os três textos em `LIMITE_COMENTARIO`). A tabela `avaliacoes` tem `notas_categorias jsonb` (0089): os critérios cabem **sem migração**; etiquetas/recomendação/notas privadas precisam ser conferidas contra as colunas existentes antes de decidir (se faltar coluna, é bloqueio da Pista B, a registrar). |
| 3–4. Avaliar serviço (cliente ↔ parceiro) | `dashboard/parceiro/avaliacao/[pedido]` e `avaliacao-imovel/[id]` são o **laudo da vistoria** (outro conceito: "laudo", não "avaliação") | Não existe formulário de nota de serviço entre pessoas (cliente→parceiro, parceiro→cliente). Pode exigir tabela/colunas novas → **verificar com a Pista B** antes de desenhar. |
| 5. Responder | `lib/avaliacoes-resposta.ts`, `data/avaliacoes-resposta-actions.ts`, `dashboard/avaliacoes/acoes.tsx` | Hoje só o proprietário responde; o despacho pede "o avaliado responde" (uma resposta pública, sem edição). Ajustar regra e texto "Como funcionam as avaliações" (`components/avaliacoes/como-funcionam-avaliacoes.tsx`). |
| 6. Perfil público do proprietário | `app/(public)/proprietario/[id]`, `components/property/reviews.tsx` / `avaliacoes-exemplo.tsx`, `lib/avaliacoes-exibicao.ts` | Conferir o bloco contra o mockup. |
| 7. Página pública do parceiro | `app/(public)/parceiros/[slug]` | Bloco de avaliações recebidas a desenhar; regra fechada: a nota parceiro→cliente **não** aparece na tela pública do cliente. |
| 8. Painel unificado | **Duas telas**: `/dashboard/avaliacoes` (menu lateral, `config/menu-por-papel.ts:178`) e `/dashboard/conta/avaliacoes` (menu da Conta, `lib/conta/secoes.ts:34`, casca `CascaConta`) | Duplicação do E85 confirmada: dois destinos, mesma lista (`avaliacoesRecebidas`). Falta decidir **qual é a canônica** (depende do mockup `avaliacoes-painel`) e redirecionar a legada **por contexto** (morador, proprietário, parceiro). |

## Plano de PRs (cada um com capturas 1280/390 lado a lado com o mockup)
1. **Painel unificado** (8): uma rota, um nome, menu lateral e Conta apontando para ela, legada redireciona; papéis morador/proprietário/parceiro.
2. **Formulário de avaliar estadia** (1–2): critérios em estrelas por par, etiquetas, recomendaria, notas privadas.
3. **Responder** (5) + texto "Como funcionam as avaliações".
4. **Perfil público do proprietário** (6) e **página do parceiro** (7).
5. **Avaliar serviço** (3–4): só depois de confirmar com a Pista B o que a base já guarda.

## Guardas respeitadas
`AUTOMACOES_ATIVO` não tocado; nenhuma migração; o E679 não é fechado por esta pista.

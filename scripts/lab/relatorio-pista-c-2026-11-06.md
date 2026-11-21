# Pista C — relatório do lote de 06/11/2026

Detalhe do que o chat resume. Só laboratório e testes: nenhum código de produto, nenhuma migração.

## Estado
- Varredura (blocos 343 a 393, 16ª volta): todos verdes a 390 e 1280 px. Defeitos novos: nenhum. **L-103 segue livre.**
- Bloco 394 (t1286): aberto em rascunho (#2999), run em andamento na hora desta escrita.
- Todos os PRs da Pista C estão em **rascunho**; nenhum foi mergeado nesta janela (merge é do Muse).

## Specs permanentes dos merges do dia
| Item | Spec | PR | Resultado |
|---|---|---|---|
| E624 Meus imóveis, contagem única | t1234 | #2872 | verde (revalidada contra a main nova) |
| E630 título vazio pendente | t1235 | #2873 | verde (a 390 abre a prévia recolhida) |
| E631 contagem do dono no cartão × perfil | t1236 | #2877 | verde |
| E633 matrícula opcional | t1237 | #2879 | verde |
| E362 `/parceiros` + E372 Meus dados | t1257 | #2939 | verde (rota certa: `/dashboard/conta/dados`) |
| SEO título do polo ≤ 60 caracteres (#2953) | t1269 | #2969 | verde |

## Guardas de regressão (06/11)
| Item | Spec | PR | Resultado |
|---|---|---|---|
| E543 número público do contrato único | t1284 | #2996 | verde — banco do lab: o gatilho 0301 sorteia outro id e nenhum par repete o número |
| E446 cidade × busca, mesma contagem | t1285 | #2997 | verde **com `test.fail`**: o defeito **reproduz na main** |

### E446 — reproduz no laboratório
Busca: `23 imóveis em Uberlândia`. Cidade: `23 imóveis + 15 de exemplo em Uberlândia` (390 e 1280). Corrigido nos PRs de produto
#2970 (Pista B) e #2971 (Pista A), ainda em rascunho. Quando entrarem, a spec "passa inesperadamente": **remover o `test.fail`**
(deixei o aviso no código) e ela fica como guarda permanente.

## Já cobertos por spec existente (não dupliquei)
- E621 `/comparar` com foto nas colunas: t914 (na main).
- E193 padrão único na qualificação: o #2956 já traz t677/t680 (cartão do bloco opcional).
- E427 nome do aceite no cabeçalho: t923 (na main); o #2978 só ajusta a falha passageira.
- E646 duração no simulador dos sócios: t200 alterada no próprio merge (#2945).

## Não feito, com o motivo
- **E477 (controles de escrita para a observadora):** o padrão da t655 exige MFA e promoção serial da observadora, e a guarda só
  é confiável com linhas de dado **real** semeadas em cada uma das 5 telas (agentes, moderação/ofensas, ajuda à publicação,
  avaliadores, solicitações). Sem isso a spec dá falso verde (tela vazia) ou falso vermelho (linha de teste mantém o botão por
  desenho). Pedir à Pista B a lista de linhas que cada tela deve esconder.
- **E414 (medição de internet não conclui) e E413 (câmera do computador):** dependem de rede/câmera simulada no navegador do
  lab. A conferir se o `playwright.config` aceita `--use-fake-device-for-media-stream` antes de prometer spec.
- **E648 (avaliador/CNPJ), E647 (forma de pagamento):** atrás de chave desligada e com os PRs ainda fora da main; a spec nasceria
  `test.fail`. Fazer quando os PRs forem para a main.

## Varredura de travas vencidas (`test.fail` / `test.skip`)
Só 3 `test.fail` no repositório, **todos ainda válidos**: t311 (L-22: `/conferir`, `/conferir/<código>` e `/alerta-busca/desligar`
com `<main>` próprio), t249 D-V8 (`/auth` sem `<main>`) e t49 (CSP ainda em Report-Only em `next.config.ts`). Os `test.skip` são
por conta de laboratório ou chave de ambiente ausente, não por defeito corrigido.

## Flakiness e infra do runner
- **"Instalar Chromium do Playwright"** travou ~21 min em vários runs (blocos 345, 348, 355, 362, 365, 373, 381, 2872–2879…). Regra
  seguida: um re-run por head; se travar de novo, trazer a base para a branch (head nova), sem commit vazio. Quando rodam, todos
  passam.
- **"Subir o Supabase local"** falhou uma vez em ~1 min (bloco 382); re-run passou.
- **Flaky real, uma vez (bloco 372):** `GET /rest/v1/profiles` com `net::ERR_ABORTED` no shell do painel, a 390 px, em
  `/prova/celular/aviso` (página estática). Não reproduziu. Ajuste da régua proposto no **#2949** (a leitura abortada vai para
  os "ignorados" do relatório; escrita abortada e outros erros continuam acusando). **Decisão do Muse**, porque afrouxa a régua
  de todas as varreduras.

## Massa do laboratório
O 400 em `/api/proximidades` em `/qualificar` do proprietário (E645, t1250 da Pista B) some quando a massa da varredura grava
`lat/lng` nos anúncios não rascunho (commit `e1ef8e805`, em `scripts/lab/massa-varredura.mjs`). Hoje esse commit vai repetido em
vários PRs da Pista C; **mergear um PR só com ele** tira o ruído dos outros.

## Numeração de specs
Colisão evitada duas vezes (t1250 era da Pista B → meu bloco 363 saiu como t1251). Conferir sempre `origin/main` **e** as branches
remotas antes de usar um número.

## Mapa do código
O repositório **não tem** um arquivo de mapa do código. Para a Pista C o equivalente é `tests/e2e/cobertura.json` (página → specs).

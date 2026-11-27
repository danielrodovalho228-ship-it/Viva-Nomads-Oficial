# Frente 0 — enxergar regressões no laboratório (correção consolidada de 11/11/2026)

## Diagnóstico

- As rodadas **schedule** e **push** de 09–11/11 gravaram em `lab_execucoes` cerca de 610 executados e 3.900 pulados. Exemplos:
  - run 43031805357: 615 passaram, 3.896 pularam;
  - run 43066673926: 603 passaram, 3.908 pularam.
- Causa dos 3.900 pulados: essas rodadas ainda usavam o desenho de **um job só**. O E744 (fatias) só entrou na main em 11/11 às 23:18 UTC (#3588). O teto global cortava a suíte. O Playwright marca o que não rodou como `skipped`, e a linha ia para o banco sem nada que dissesse "incompleta".
- As rodadas completas (disparo manual do branch do E744, 09–10/11) mostravam o quadro real: cerca de 4.100 passaram e cerca de 150 falharam.
- Hoje a main já tem o E744: 20 fatias (16 gerais + 4 da varredura t48) e um job consolidar que grava uma linha. Faltavam quatro coisas:
  - o build único;
  - a conferência de completude;
  - o detector de regressão;
  - tirar o push.

## O que mudou

1. **Sem push na main.** O `laboratorio.yml` roda só no agendado (06:00 UTC) e no disparo manual. O portão de cada PR segue sendo o `lab-critico`.
2. **Build único.** O job novo `construir` faz `npm run build` uma vez e guarda o `.next` (sem `.next/cache`) num artifact. As 20 fatias o reaproveitam. Duas guardas:
   - **Chave anônima.** As `NEXT_PUBLIC_` entram no bundle no build. A fatia confere o sha256 da chave anônima do Supabase dela contra o do build e para com erro claro se diferir. A chave nunca é gravada, só o hash.
   - **Páginas pré-renderizadas.** Home, /buscar, /cidades, /imoveis e as estáticas foram geradas com o banco do job de build. Antes do `next start`, a fatia roda `scripts/lab/limpar-prerender.mjs`, que apaga a saída do prerender de cada rota do `prerender-manifest.json` e o `.next/server/route-cache`. O servidor gera cada página na primeira visita com o banco da fatia.
   - **Prova** (next 16.4.2, app mínimo, `MARCA=build` no build e `MARCA=shard` no start):

     | Estado do `.next`     | `/` (revalidate 60) | `/est` (estática) | `/din` (dinâmica) |
     |-----------------------|---------------------|-------------------|-------------------|
     | intacto               | `build`             | `build`           | `shard`           |
     | depois do script      | `shard` (200)       | `shard` (200)     | `shard`           |

     Só apagar o `route-cache` não basta: o Next o recria a partir de `server/app/<rota>.html`.
3. **Completude** (`scripts/lab/conferir-completude.mjs`). O `construir` gera `playwright test --list --reporter=json` do mesmo commit, hoje com 4.516 testes. O consolidar compara essa listagem com o resultado juntado das fatias. A chave de cada teste é `projeto › arquivo › describe › título`.

   | Situação do teste | Como aparece no JSON do Playwright (conferido no 1.61) | Conta como |
   |---|---|---|
   | rodou até o fim | passou, falhou, instável ou falha conhecida | executado |
   | pulado de propósito (`test.skip`/`test.fixme`) | `expectedStatus: "skipped"` | pulo declarado |
   | cortado pelo teto global | `status: "skipped"` com `expectedStatus: "passed"` | não executado |
   | nunca começou | `skipped` com `results: []` | não executado |
   | fatia perdida | ausente do relatório | não executado |

   Rodada com algum "não executado" deixa o consolidar vermelho e lista os testes no resumo.
4. **Detector de regressão** (`scripts/lab/detectar-regressoes.mjs`).
   - **Regressão:** spec com algum registro **verde** em `lab_execucoes` (`passou > 0` e `falhou = 0`) e **vermelho** na rodada atual (`falhou > 0`).
   - **Histórico:** lido do banco no passo "Registrar no banco", antes de gravar a rodada. Os registros de `pull_request` ficam de fora, porque era código que não estava na main.
   - **Resultado:** lista não vazia deixa o job vermelho e vai para o resumo com a data do último verde. Sem histórico, o job também fica vermelho, porque não dá para afirmar que não houve regressão.
5. **Migração 0341.** Cria em `lab_execucoes` as colunas `listados`, `executados`, `nao_executados` e `regressoes` (jsonb). Inclui o aplicar idempotente e o rollback.
   - A 0340 não foi usada porque já está no #3726 (Renato A). Ver Dúvidas.

## Provas

- **Detector no histórico real** (produção, só leitura). Aplicada à última rodada completa (5eb1fad9, 10/11 10:47 UTC, run 42792426869) com o histórico anterior a ela, a regra acha **35 specs**: exatamente a lista dos 35 do coordenador (t38, t39, t40, t64, t66, t70, t71, t77, t78, t79, t81, t85, t88, t112, t161, t176, t186, t195, t204, t227, t229, t231, t241, t250, t273, t286, t288, t292, t295, t296, t373, t683, t692, t839, t840). A única diferença é de data: o t227 aparece com último verde em 05/11 UTC, contra 04/11 no horário de Chicago.
- **Chaves da completude batem com uma execução real.** Rodei o t1 de verdade (4 testes, falhando porque não havia servidor). Os 4 saíram da lista dos não executados; os 4.512 restantes ficaram nela.
- **Migração no Postgres 16 local** (`docs/e744-frente0-prova-postgres/prova-0341.sql`):
  - o aplicar roda duas vezes e registra uma só;
  - a consulta do histórico pega o t132 verde e ignora o spec só vermelho e a linha de pull_request;
  - o insert do workflow grava 4516/4500/16 e a regressão;
  - `numeros` vazio não derruba o insert;
  - o rollback tira as 4 colunas e o registro, e a reaplicação volta com elas.

## Prova ao vivo (Muse)

Na primeira rodada agendada depois do merge, conferir em `lab_execucoes`:

```sql
select criada_em, gatilho, listados, executados, nao_executados, pulou, jsonb_array_length(regressoes) as regressoes
  from public.lab_execucoes order by criada_em desc limit 1;
```

O esperado:
- `executados + pulos declarados = listados`, com `nao_executados = 0`;
- `pulou` perto de zero, só os pulos declarados (dezenas, não milhares).

O job deve ficar vermelho enquanto existirem as regressões da Frente 3: é o detector funcionando.

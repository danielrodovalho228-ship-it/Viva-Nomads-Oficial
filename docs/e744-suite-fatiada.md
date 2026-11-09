# E744 — a suíte noturna precisa TERMINAR (fatiamento em jobs paralelos)

## O problema
Run 42471821063 do "Laboratório de testes (noturno)": 640 testes rodaram, 3.864 NÃO rodaram — o Playwright morreu no `--global-timeout=3900000` (65 min). A suíte tem ~4.500 testes em 838 specs; com 2 workers em um runner, o ritmo medido foi ~6 s por teste, então um job só precisaria de ~7,5 h.

## O desenho (só o workflow noturno/da main; o gate de PR não muda)
- **16 fatias paralelas** (`strategy.matrix.fatia: [1..12]`, `--shard=<fatia>/12` do Playwright, `fullyParallel: true`, então os testes se distribuem de forma equilibrada). Cada fatia é um job independente: sobe o próprio Supabase local, personas, build, site e Chromium — nenhum estado compartilhado entre fatias.
- Cada fatia: ~4.500 / 16 ≈ 280 testes ≈ 29 min de testes + ~10 min de preparo ≈ 40 min, dentro do `--global-timeout` de 65 min e do `timeout-minutes: 90` de cada job. Margem para crescer: até ~600 testes por fatia (~9.600 no total) antes de precisar de mais fatias — é só trocar o `16` na matriz e no `--shard` (um teste de guarda confere que os dois e o `--esperadas` do consolidar são o mesmo número).
- `fail-fast: false`: uma fatia vermelha não cancela as outras.
- Cada fatia guarda o próprio artifact (`laboratorio-<run>-fatia-<n>`: relatório, prints, vídeos, `resultado.json`) e fica vermelha se algum teste dela falhou.
- **Job `consolidar`** (`needs: laboratorio`, roda mesmo com fatia vermelha): baixa os artifacts, junta os `resultado.json` (`scripts/lab/juntar-resultados.mjs`: concatena `suites`, soma `stats`; fatia sem arquivo só avisa), escreve o resumo por spec e grava **uma linha** em `public.lab_execucoes` (o passo "Registrar no banco", único com `SUPABASE_DB_URL`, nunca em PR). Fica vermelho se qualquer fatia falhou.

## O gate de merge
A mudança de gate (suíte completa fatiada como check obrigatório) é o E775, em PR separado (`docs/e775-fila-de-merge.md`): `merge_group` + check `suite-completa`.

## O que NÃO muda
- A regra de testes escopados durante a correção continua. O que muda é a rede de regressão: a suíte completa agora termina, fatiada e verde.
- Sem segredo antes do passo de registro; sem rede (modo simulado).

## Verificação
Testes de guarda: `tests/laboratorio/lab-fatias.test.ts` (matriz 1..N = `--shard` = `--esperadas`; artifact por fatia; um único registro; consolidar vermelho se fatia falhou; junção dos resultados) e os existentes do laboratório (`lab-tempo-limite`, `lab-critico`, `laboratorio.test`): 131 verdes. O resultado da primeira execução fatiada (tempo por fatia, testes rodados × não rodados) é registrado abaixo quando o disparo manual terminar.

## Resultado da primeira execução fatiada

**Run 42536824482** (`workflow_dispatch`, commit `1cbe987`, ainda com 12 fatias). O run de 16 fatias (42538098625, commit `7afef87`) ficou na fila do grupo de concorrência atrás dele; o resultado dele entra aqui quando terminar.

| Fatia | Passo "Rodar a suíte E2E" | Observação |
|---|---|---|
| 1 | 30 min 42 s | testes falharam (fatia marcada vermelha) |
| 2 | 40 min 38 s | idem |
| 3 | 27 min 45 s | idem |
| 4 | 19 min 57 s | idem |
| 5 | 38 min 14 s | idem |
| 6 | 42 min 22 s | idem |
| 7 | 29 min 00 s | idem |
| 8 | acima de 50 min | ainda em andamento na leitura |
| 9 | 19 min 23 s | idem |
| 10 | 37 min 03 s | idem |
| 11 | não rodou | falhou em "Subir o Supabase local" (3 tentativas); sem artifact |
| 12 | 22 min 26 s | idem |

**O que isso prova**
- A suíte **termina**: nenhuma fatia chegou ao teto de 65 min até aqui; o passo da suíte levou de 19 a 43 min (o run noturno antigo morria no teto com 640 testes de 4.504).
- As fatias que rodaram ficaram **vermelhas por falhas reais de teste**, que ficavam escondidas porque a suíte nunca chegava ao fim. O trabalho seguinte é triar essas falhas (lista no resumo do job `consolidar`), não mexer no fatiamento.
- A duração por fatia varia de 19 a 43 min: o `--shard` divide por quantidade de testes, não por duração. Subir de 12 para 16 fatias reduz o pior caso e dá folga para o crescimento da suíte.
- Fatia 11: falha de infraestrutura no `supabase start` (o passo já tenta 3 vezes). Com `fail-fast: false` as outras fatias não são afetadas, e o `consolidar` acusa a fatia ausente (`--esperadas`).

## Triagem do run 42536824482 (12 fatias, concluído em 09/11 00:56 UTC: failure)
1. **Defeito do consolidar (meu, corrigido neste PR):** "Registrar no banco" falhou com `psql: Argument list too long`. O resumo da suíte inteira (por spec + falhas) passou de 128 KB e ia como `-v resumo="$RESUMO"`; o `execve` recusa argumento acima disso. Correção: o resumo e a cobertura vão para arquivos e o psql os lê com `\set resumo \`cat ...\``. Guarda em `lab-fatias.test.ts`. Prova só no próximo run (o psql local não tinha servidor para testar o fim a fim).
2. **Fatia 8 estourou o teto:** o passo da suíte rodou até 00:55 (65 min = `--global-timeout`), o único que bateu no teto. Prova de desequilíbrio do `--shard` (por quantidade de testes, não por duração); as outras fatias levaram 19 a 43 min. Os 16 jobs reduzem a carga por fatia (~280 testes); se a 8 equivalente ainda estourar, o próximo passo é fatiar por arquivo de spec balanceado por duração.
3. **Fatia 11:** falhou em "Subir o Supabase local" nas 3 tentativas e não gerou artifact. O log só traz o resumo do passo; a causa não está no que a API devolve sem o log completo do step. Tratada como infraestrutura até repetir: se repetir no run de 16 fatias, abrir diagnóstico com `supabase start --debug`.
4. **Falhas reais de teste (fatias 1–7, 9, 10, 12):** todas ficaram vermelhas só no passo "Marcar a fatia como falha" (o Playwright saiu com código 1). Os nomes dos testes que falharam ficam no `resultado.json` de cada fatia (artifact `laboratorio-<run>-fatia-N`) e, agora, na linha de `lab_execucoes` quando o consolidar gravar. **Sem a linha do banco nem acesso aos artifacts por esta sessão, não consigo listar os testes.** Isso fecha quando o run de 16 fatias gravar a linha.

**Run de 16 fatias (42538098625):** ficou na fila do grupo de concorrência até o run de 12 terminar e começou às 00:56 UTC; resultado a registrar aqui quando concluir (≈ 01:50 UTC).

## Run de 16 fatias (42538098625) — veredito final (concluído 09/11 02:06 UTC: failure)
Rodou no commit `7afef87` (antes das correções do consolidar e do `supabase start`). Passo "Rodar a suíte E2E" por fatia:

| Fatia | Veredito | Suíte |
|---|---|---|
| 2 | **verde** | 31 min |
| 1, 3, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16 | vermelhas só no passo "Marcar a fatia como falha" (o Playwright saiu com código 1 = falhas reais de teste) | 15 a 29 min |
| 4 | **infra**: `supabase start` falhou 3 vezes (`failed to bind host port 0.0.0.0:54322/tcp: address already in use`); nenhum teste rodou | 0 |
| 11 | vermelha e **bateu o teto de 65 min** (`--global-timeout`): há algo lento ou pendurado nesta fatia | 65 min |
| consolidar | vermelho: "Registrar no banco" falhou (o bug do `psql` com argumento grande, já corrigido) e depois "alguma fatia falhou" | — |

**Veredito:** a suíte completa **termina** em 15 das 16 fatias em no máximo 31 min. O gate completo **não está verde**: 13 fatias com falhas reais de teste, uma fatia sem rodar (infra) e uma que estoura o teto.

**Triagem do que é da suíte fatiada (corrigido neste PR):**
1. Registro no banco (E2BIG): corrigido (arquivo + `\set ... \`cat\``).
2. `supabase start` com a porta 54322 presa (fatias 4 aqui e 11 no run de 12): 5 tentativas + reinício do Docker.
3. Fatia lenta (11 aqui; 8 no run de 12): o `--shard` balanceia por quantidade. A fatia que estoura muda de run para run, o que aponta para um ou poucos testes que penduram (espera sem fim), não para um spec sempre pesado. A lista por spec e as durações saem do `resultado.json`; o run em andamento (42547901640) é o primeiro que as grava na linha de `lab_execucoes`.

**Fora do escopo do fatiamento (a triar quando houver os nomes):** as falhas reais de teste das 13 fatias vermelhas. Cada uma é defeito de produto ou de spec e não se corrige no workflow; entram como lista para a Pista C / QA.

## Fatia 11/16: causa e correção (09/11, 03:05 UTC)
No run 42538098625 e no 42547901640 a fatia que estoura o teto é a MESMA, **11/16**. Listei o que cai nela (`playwright test --list --shard=11/16`): 279 testes, dos quais **208 são de dois specs de segurança** (`t50-rls-todas-tabelas`, 149; `t49-seguranca-publica`, 59). Esses testes custam ~3x mais que a média (varrem o RLS de todas as tabelas), e o `--shard` divide por quantidade; por isso uma fatia ficou com todo o peso.

**Correção:** `SPECS_PESADOS` em `playwright.config.ts`. As fatias 1–16 rodam a suíte **sem** eles (`LAB_PESADOS=fora`, ~264 testes cada, medido com `--list`); as fatias 17–20 rodam **só** eles (`t50` e `t49`, 4 partes de ~70). A matriz passa a 20 jobs; o consolidar espera 20; os testes de guarda foram atualizados (`lab-fatias.test.ts`). Fatia 4 do run em curso rodou normalmente (22 min): o reinício do Docker contra a porta presa não foi exercitado de novo, então segue sem prova.

**Triagem das falhas reais (13 fatias vermelhas):** continua pendente dos nomes dos testes. O run em curso (42547901640) foi disparado antes desta correção; os nomes saem do primeiro run no código corrigido (linha de `lab_execucoes` e artifacts).

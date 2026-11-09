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

## Resultado do run 42547901640 e triagem por nome (09/11, 03:20 UTC)
O consolidar gravou a linha em `lab_execucoes`: **3.938 passaram · 235 falharam · 317 pularam · 8 instáveis = 4.498 testes, a suíte inteira rodou.** Os nomes das 243 entradas por spec e por categoria estão em `docs/e744-triagem-falhas.md`: 134 asserção/elemento, 55 screenshot (t245, t271, t263), 37 varredura, 17 timeout de 45 s. Nenhuma é do fatiamento; é dívida de testes que a suíte nunca chegava a mostrar. A fatia 11 estourou o teto (65 min) neste run, o que a separação dos specs pesados (t50/t49) corrige no run seguinte (42554301427, na fila).

## Estado do run com a separação dos specs pesados (09/11, 03:25 UTC)
O run **42554301427** (commit `783d9d2`, 16 fatias gerais + 4 fatias dos specs t50/t49) segue **na fila** (`queued`): não começou, então ainda não há resultado sobre a fatia 11 nem sobre as fatias 17–20. Prova local já feita: `--list` mostra 263 a 265 testes por fatia geral e ~70 por fatia pesada, e `t50` não aparece mais nas gerais. A verificação real é o conjunto: nenhuma fatia perto do teto de 65 min.

**Decisão que NÃO é desta pista (coordenador):** zerar a lista de 243 falhas (`docs/e744-triagem-falhas.md`) antes de exigir `suite-completa`, ou fixar uma linha de base "não pode piorar" e pagar a lista por módulo. Esta pista não decide.

## Correção do desenho: a causa da fatia lenta era o t48-varredura, não o t50/t49 (09/11, 04:30 UTC)
O run 42554301427 (com t50/t49 em fatias próprias) mostrou: as fatias 17–20 (t50/t49) **terminam em ~16 segundos** e passam (os 280 testes são baratos, a hipótese anterior estava errada), e a **fatia 11 continua pendurada** (47 min e subindo), mesmo sem eles. Cruzando as duas composições da fatia 11 (antes e depois) sobram 15 specs em comum; entre eles, `t48-varredura.spec.ts` é `test.describe.configure({ mode: "serial" })` e tem `setTimeout` de 15 min (2 testes) e 30 min (3 testes, um por persona): uma **cadeia serial de até ~100 min** que o `--shard` não quebra. Ela cai inteira na mesma fatia e estoura o teto de 65 min.

**Correção:** `SPECS_PESADOS` passa a ser só o `t48-varredura`; as fatias 1–16 o excluem (`LAB_PESADOS=fora`, 4.496 testes no total, 0 do t48) e as fatias 17–20 o rodam por grupo de testes via `--grep`: visitante (4 testes), inquilino (1), proprietário (1) e admin (1) — os 7 testes do t48, sem sobreposição (conferido com `--list`). Cada grupo leva no máximo ~30 min em paralelo com o resto. t50/t49 voltam às fatias gerais. Teste de guarda atualizado (`lab-fatias.test.ts`).

## Resultado do run 42560445737 (com o t48 em fatias próprias; 09/11, 05:12 UTC)
**A suíte completa terminou em 61 min** (a referência antiga era 640 rodados e 3.864 não rodados). Linha em `lab_execucoes`: **3.940 passaram · 236 falharam · 316 pularam · 6 instáveis** (242 entradas; 4.498 testes).
- Fatias gerais 1–16: 4 a 31 min cada. **A fatia 11 deixou de travar (4 min).** Nenhuma fatia estourou o teto.
- Fatias da varredura t48: 17 (visitante) 1 min, 18 (inquilino) 18 min, 19 (proprietário) 20 min, **20 (admin) 56 min** — todas verdes, mas a 20 passou perto do teto de 65 min; por isso as fatias 17–20 passam a ter teto de 100 min e o job 120 min (as gerais seguem em 65). Teste de guarda em `lab-fatias.test.ts`.
- O consolidar ficou vermelho só porque as 236 falhas de teste persistem (triagem em `docs/e744-triagem-falhas.md`). **O gate "suíte completa" continua não verde** por causa dessas falhas, não do fatiamento; a decisão (zerar a lista ou fixar linha de base "não pode piorar") segue com o coordenador.

## Próximo fatiamento: o admin da varredura t48 em duas fatias (09/11)
- **Caminho crítico:** a suíte completa levou 61 min e a fatia 20 (admin) levou 56 min, o resto dela. O teste `admin: todas as telas logadas` varria 390 px e depois 1280 px **em série, com um login só**.
- **Mudança:** o t48 passa a ter um teste por largura e persona (`<persona>: todas as telas logadas (390 px)` e `(1280 px)`), cada um com o próprio login. No laboratório, o admin roda em duas fatias: **20 = 390 px** e **21 = 1280 px**. Inquilino (18) e proprietário (19) seguem com as duas larguras em série (cada um levou 18–20 min).
- **Matriz:** 16 gerais + 5 da varredura = 21 fatias; `--esperadas 21`. Cobertura conferida com `playwright --list`: cada grep acha exatamente o(s) teste(s) esperado(s), sem sobreposição.
- **Esperado:** o admin cai para cerca de metade (~28 min), e a suíte completa passa a ser limitada pelas fatias gerais (até ~31 min) mais o preparo. **Não medido:** isso só se confirma no próximo run do laboratório.
- **Teste de guarda:** `tests/laboratorio/lab-fatias.test.ts` (matriz 1..21, um grep por teste do admin, `--esperadas 21`).

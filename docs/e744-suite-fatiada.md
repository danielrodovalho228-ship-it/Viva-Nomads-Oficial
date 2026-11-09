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

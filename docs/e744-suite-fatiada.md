# E744 — a suíte noturna precisa TERMINAR (fatiamento em jobs paralelos)

## O problema
Run 42471821063 do "Laboratório de testes (noturno)": 640 testes rodaram, 3.864 NÃO rodaram — o Playwright morreu no `--global-timeout=3900000` (65 min). A suíte tem ~4.500 testes em 838 specs; com 2 workers em um runner, o ritmo medido foi ~6 s por teste, então um job só precisaria de ~7,5 h.

## O desenho (só o workflow noturno/da main; o gate de PR não muda)
- **12 fatias paralelas** (`strategy.matrix.fatia: [1..12]`, `--shard=<fatia>/12` do Playwright, `fullyParallel: true`, então os testes se distribuem de forma equilibrada). Cada fatia é um job independente: sobe o próprio Supabase local, personas, build, site e Chromium — nenhum estado compartilhado entre fatias.
- Cada fatia: ~4.500 / 12 ≈ 375 testes ≈ 38 min de testes + ~10 min de preparo ≈ 50 min, dentro do `--global-timeout` de 65 min e do `timeout-minutes: 90` de cada job. Margem para crescer: até ~600 testes por fatia (~7.200 no total) antes de precisar de mais fatias — é só trocar o `12` na matriz e no `--shard` (um teste de guarda confere que os dois e o `--esperadas` do consolidar são o mesmo número).
- `fail-fast: false`: uma fatia vermelha não cancela as outras.
- Cada fatia guarda o próprio artifact (`laboratorio-<run>-fatia-<n>`: relatório, prints, vídeos, `resultado.json`) e fica vermelha se algum teste dela falhou.
- **Job `consolidar`** (`needs: laboratorio`, roda mesmo com fatia vermelha): baixa os artifacts, junta os `resultado.json` (`scripts/lab/juntar-resultados.mjs`: concatena `suites`, soma `stats`; fatia sem arquivo só avisa), escreve o resumo por spec e grava **uma linha** em `public.lab_execucoes` (o passo "Registrar no banco", único com `SUPABASE_DB_URL`, nunca em PR). Fica vermelho se qualquer fatia falhou.

## O que NÃO muda
- O gate de merge continua sendo o `lab-critico` (lista crítica + specs do próprio PR); a suíte completa nunca rodou em PR (decisão de 21/10) e continua só no noturno (03h BRT), em `workflow_dispatch` e no push na `main`.
- A regra de testes escopados durante a correção continua. O que muda é a rede de regressão: a suíte completa agora termina, fatiada e verde.
- Sem segredo antes do passo de registro; sem rede (modo simulado).

## Verificação
Testes de guarda: `tests/laboratorio/lab-fatias.test.ts` (matriz 1..N = `--shard` = `--esperadas`; artifact por fatia; um único registro; consolidar vermelho se fatia falhou; junção dos resultados) e os existentes do laboratório (`lab-tempo-limite`, `lab-critico`, `laboratorio.test`): 131 verdes. O resultado da primeira execução fatiada (tempo por fatia, testes rodados × não rodados) é registrado abaixo quando o disparo manual terminar.

## Resultado da primeira execução fatiada
(a preencher com o run do `workflow_dispatch` nesta branch)

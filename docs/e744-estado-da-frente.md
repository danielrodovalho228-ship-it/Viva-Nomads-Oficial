# E744 — estado da frente (a suíte noturna fatiada a completar inteira)

**Este arquivo é a continuidade da frente.** Se a sessão for compactada ou trocada, quem chega lê este arquivo primeiro e segue daqui. Ele é atualizado a cada passo (ver "Diário" no fim).

- **Entrega:** UMA rodada completa verde da noturna fatiada (`.github/workflows/laboratorio.yml`): todas as fatias executadas até o fim, sem corte, resultado agregado legível. Relato não fecha: a prova é a rodada.
- **Branch de trabalho:** `claude/affectionate-davinci-x0dfgp` (um PR por passo coerente, sempre draft até o julgamento do Gerente).
- **Regras da frente (Gerente, 15/11):**
  1. Não baixar a fasquia: não apagar teste, não alargar tempo limite para esconder lentidão sem dizer.
  2. Referências visuais (t245, t263, t271): **não regravar nada em silêncio.** Para cada spec, apresentar o diff (o que mudou e por quê); o Gerente julga um a um. Mudança legítima aprovada regrava-se com o julgamento registrado no PR; mudança não intencional é regressão para corrigir.
  3. Separar "falha de infra/fatia" de "falha de produto". As de produto voltam para o Gerente como itens; não se calam com nova tentativa nem se apagam.
  4. Números medidos (executados × total, por fatia, com tempos).
  5. Migração: uma pista por vez. Avisar o Gerente ANTES de abrir qualquer migração.
  6. Nenhum PR mescla com o verde de uma main que já mudou: antes do merge, atualiza sobre a main do momento e roda CI + lab-crítico outra vez.
  7. Consumo do plano: quando não estiver visível, escrever "não visível"; nunca estimar.
- **Ordem em vigor desde 15/11, 14:20 UTC (Prompt A do coordenador, ORDEM-DUET-041):** a entrega crítica é a **tabela única de classificação das 96 specs vermelhas**, no PR #3832, até quarta 18/11 às 07:00 CST. Colunas: spec, classe (teste velho / infra-tempo / defeito real / instável), evidência, ação, pista dona. Teste velho só com decisão citada; sem decisão é defeito real. A Fable só classifica e corrige o que é da área dela (casca do painel, preço/cartão, `proxy.ts`, store de sessão); as correções de teste velho e infra/tempo vão agrupadas para a Code 2; os defeitos reais vão como itens novos para o Gerente. A tabela vale mais que as correções. **A tabela está em `docs/e744-classificacao-96-specs.md`.**
- **Plano de aceleração (ORDEM-DUET-046, 15/11):** (a) todo PR leva o pacote de evidência: log dos testes com o SHA do commit testado e prints a 390 e 1280 px das superfícies mudadas, dizendo o que rodou e o que não rodou; evidência não fecha item. (b) Antes de cada ordem da fila, conferir se ela ainda vale sobre a main do momento; se não valer, avisar o Gerente antes. (c) A sessão não troca no meio do Prompt A.
- **Regras da casa que seguem valendo:** `CLAUDE.md` e `AGENTS.md` (nunca merge, nunca push na main, plano só na descrição do PR, "pronto" só com a saída do teste colada).
- **Depois do E744** (só para saber a fila; nada disso arranca agora): Família 5 (Painel/conta): resíduos do E793 → E900 (só depois da Onda 0 do E793), e na mesma família o E85 e o E167 (navegação da Conta/morador).

## 1. Estado real em 15/11/2026 (01:20 UTC)

**A rodada completa NÃO está verde.** O fatiamento funciona: a suíte termina inteira em cerca de 1 h e não houve nenhuma falha de infraestrutura nas três últimas noturnas. O vermelho vem de falhas de teste (140 na última noturna, em 80 specs), de 88 testes que não chegaram a rodar e de 35 regressões.

O desenho que está na `main`:

- **`construir`**: um build só e a listagem do commit (`playwright test --list --reporter=json`).
- **`laboratorio (fatia N/20)`**: 20 jobs em paralelo, `fail-fast: false`.
  - Fatias 1–16: a suíte sem o `t48-varredura` (`LAB_PESADOS=fora`, `--shard=N/16`, 2 workers, 90 s por teste, teto global de 65 min).
  - Fatias 17–20: só o `t48-varredura`, um grupo por fatia (visitante, inquilino, proprietário, admin), 1 worker, teto global de 100 min.
  - Cada fatia sobe o próprio Supabase local e guarda o próprio artifact. Fica vermelha se algum teste falhou.
- **`consolidar`**: junta os resultados (`scripts/lab/juntar-resultados.mjs`), confere a completude (`scripts/lab/conferir-completude.mjs`), grava UMA linha em `public.lab_execucoes` de produção e roda o detector de regressão (`scripts/lab/detectar-regressoes.mjs`). Fica vermelho se alguma fatia falhou, se algum teste listado não rodou ou se há regressão.
- **Quando roda:** agendado (`cron: "0 6 * * *"`) e disparo manual. Não roda em PR nem em push.

Documentos anteriores da frente: `docs/e744-suite-fatiada.md` (desenho e histórico até 09/11), `docs/e744-frente0-regressoes.md` (build único, completude, detector), `docs/e744-completude-12-11.md` (inventário de 12/11), `docs/e744-triagem-falhas.md` (triagem de 09/11).

## 2. As três últimas noturnas, uma a uma

Fontes: a API do GitHub Actions (jobs e passos de cada run) e a linha de cada rodada em `lab_execucoes` de produção (consulta somente leitura).

| | 12/11 | 13/11 | 14/11 |
|---|---|---|---|
| Run | 43240944116 | 43439599928 | 43598204720 |
| Commit | `f2a1ae81` | `5d7b34a9` | `7f8eff52` |
| Início → fim (UTC) | 14:47 → 15:51 | 14:06 → 15:10 | 13:07 → 14:12 |
| Listados | 4.540 | 4.592 | 4.601 |
| Executados | 4.355 | 4.394 | 4.419 |
| Não executados | 92 | 104 | 88 |
| Passaram | 4.218 | 4.238 | 4.272 |
| Falharam | 127 | 146 | 140 |
| Specs com falha | 69 | 85 | 80 |
| Regressões (já foram verdes) | 23 | 39 | 35 |
| Fatias verdes | 8 de 20 (1, 2, 5, 11, 17–20) | 5 de 20 (5, 17–20) | 5 de 20 (5, 17–20) |
| Fatia perdida ou cortada | nenhuma | nenhuma | nenhuma |
| `construir` | verde | verde | verde |
| `consolidar` | vermelho | vermelho | vermelho |

- Nas três, toda fatia vermelha ficou vermelha **só** no passo "Marcar a fatia como falha se algum teste falhou". Nenhuma falhou em subir o Supabase, no build ou por tempo.
- Antes de 12/11 a noturna rodava num job só: cerca de 610 executados e 3.900 pulados.
- A leitura de "12 de 20 fatias verdes" não aparece em nenhuma rodada que eu tenha achado. O máximo foi 8 de 20, em 12/11.
- **A noturna de 14/11 é anterior a 14 PRs já mesclados** (#3817 a #3831, com o E899 e as Famílias 1 a 3). A noturna de 15/11 ainda não tinha rodado na hora desta leitura.
- **Atraso do agendamento:** o cron é 06:00 UTC, mas as três rodadas começaram às 14:47, 14:06 e 13:07 UTC (7 a 9 h depois).

Fatia por fatia nas três noites (veredito · duração do passo "Rodar a suíte E2E"):

| Fatia | 12/11 | 13/11 | 14/11 |
|---|---|---|---|
| 1 | verde · 24 min | vermelha · 26 min | vermelha · 24 min |
| 2 | verde · 32 min | vermelha · 28 min | vermelha · 29 min |
| 3 | vermelha · 26 min | vermelha · 22 min | vermelha · 20 min |
| 4 | vermelha · 20 min | vermelha · 29 min | vermelha · 27 min |
| 5 | verde · 13 min | verde · 9 min | verde · 9 min |
| 6 | vermelha · 22 min | vermelha · 16 min | vermelha · 20 min |
| 7 | vermelha · 26 min | vermelha · 28 min | vermelha · 30 min |
| 8 | vermelha · 28 min | vermelha · 34 min | vermelha · 27 min |
| 9 | vermelha · 26 min | vermelha · 25 min | vermelha · 26 min |
| 10 | vermelha · 20 min | vermelha · 21 min | vermelha · 20 min |
| 11 | verde · 5 min | vermelha · 7 min | vermelha · 7 min |
| 12 | vermelha · 14 min | vermelha · 16 min | vermelha · 15 min |
| 13 | vermelha · 26 min | vermelha · 26 min | vermelha · 25 min |
| 14 | vermelha · 24 min | vermelha · 25 min | vermelha · 22 min |
| 15 | vermelha · 18 min | vermelha · 21 min | vermelha · 19 min |
| 16 | vermelha · 15 min | vermelha · 13 min | vermelha · 13 min |
| 17 | verde · 1 min | verde · 2 min | verde · 1 min |
| 18 | verde · 19 min | verde · 19 min | verde · 19 min |
| 19 | verde · 20 min | verde · 19 min | verde · 19 min |
| 20 | verde · 55 min | verde · 56 min | verde · 55 min |

### 2.1 Rodada manual de 15/11 na main de hoje (Decisão A do Gerente) — É A BASE DA TRIAGEM

Run [43664453319](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/actions/runs/43664453319), `workflow_dispatch`, main `c950ec82` (já com o #3831), 01:43 → 02:48 UTC de 15/11.

| Medida | Noturna 14/11 (`7f8eff52`) | Manual 15/11 (`c950ec82`) |
|---|---|---|
| Listados | 4.601 | 4.659 |
| Executados | 4.419 | 4.464 |
| Não executados | 88 | 93 |
| Passaram | 4.272 | 4.284 |
| Falharam | 140 | **163** |
| Instáveis | 6 | 16 |
| Specs com falha | 80 de 867 | **96 de 879** |
| Regressões | 35 | **51** |
| Fatias verdes | 5 de 20 | 5 de 20 (5, 17–20) |
| Fatia perdida ou cortada | nenhuma | nenhuma |

**A main de hoje está pior que a de 14/11.** Dos 80 specs vermelhos, só 2 saíram (t88 e t176, corrigidos no #3830) e 18 entraram. As falhas visuais não mudaram (54: t245 37, t271 11, t263 6).

Por fatia (veredito e minutos do passo da suíte): 1: vermelha 23 min · 2: vermelha 34 min · 3: vermelha 23 min · 4: vermelha 28 min · 5: verde 7 min · 6: vermelha 19 min · 7: vermelha 26 min · 8: vermelha 30 min · 9: vermelha 24 min · 10: vermelha 25 min · 11: vermelha 7 min · 12: vermelha 13 min · 13: vermelha 24 min · 14: vermelha 21 min · 15: vermelha 22 min · 16: vermelha 12 min · 17: verde 2 min · 18: verde 18 min · 19: verde 20 min · 20: verde 56 min. Os números de testes por fatia desta rodada não foram reconstruídos; saem sozinhos no resumo a partir do Passo 1.

**Os 18 specs que entraram:**

| Grupo | Specs | Erro | Leitura |
|---|---|---|---|
| Botão flutuante de volta à `/buscar` (E931, #3831, mesclado em 15/11 00:31) | t10, t244, t436 | `fale-com-a-viva` esperado escondido na `/buscar`, está visível | **Spec desatualizado por decisão registrada.** O E931 devolveu o botão à `/buscar` e à `/ajuda` (documento `docs/reprovas-e916-e915-e917-e887-e931.md`); atualizou o t59 e os testes unitários, mas não estes três. |
| Busca a 390 px: cartão coberto por elemento fixo | t274, t368, t412, t419, t732, t1405, t1423, t1426, t1451 | `"Centro, Uberlândia - MG Novo na plataform…" coberto por elemento fixo mesmo depois de rolar até ele (butt…` | **Não classificado.** O erro vem cortado em 300 caracteres (não dá para ler qual botão cobre o cartão). Medi no laboratório local: a 390 px o botão flutuante está escondido (`max-md:hidden`), e a varredura da busca passou duas vezes (banco com restos e banco novo). Ver 7.3. |
| Rotas da Conta | t279, t354 (e parte do t1423) | esperam `/dashboard/conta`, recebem `/dashboard/conta/perfil` | São 3 dos 4 specs que o Passo 2 já tinha corrigido por prevenção ("passam só pela ordem das telas"). |
| Outros | t228 (3 falhas: `/contato` responde para `/ajuda/fale-com-a-viva`, o spec espera `/ajuda`), t815 (404: alvo de toque de 32 px, mínimo 44), t574 ("Voltar aos resultados") | — | A triar no Passo 3. O t228 e o t815 apontam para o #3831 (E916 mexeu na 404) e para a Família 2 (remissões). |
| Instável que virou falha | t389 | — | A triar. |

## 3. A noturna de 14/11 por fatia

O resumo da rodada não traz números por fatia, e o log de cada fatia não mostra o resumo do Playwright (a saída vai para um arquivo do artifact, que esta sessão não consegue baixar). Refiz o mapa teste → fatia com `LAB_PESADOS=fora npx playwright test --list --shard=N/16 --reporter=json` no commit `7f8eff52` (a soma dá 4.601, igual à listagem da rodada) e cruzei com `por_spec` e `falhas` da linha de `lab_execucoes`.

| Fatia | Listados | Rodaram | Falharam | Instáveis | Suíte (min) | Veredito |
|---|---|---|---|---|---|---|
| 1 | 288 | 285 | 2 | 0 | 24,1 | vermelha |
| 2 | 288 | 288 | 3 | 0 | 29,3 | vermelha |
| 3 | 287 | 281 | 2 | 0 | 19,9 | vermelha |
| 4 | 287 | 275 | 6 | 1 | 26,6 | vermelha |
| 5 | 290 | 282 | 0 | 0 | 8,6 | verde |
| 6 | 284 | 273 | 37 | 0 | 19,7 | vermelha (só o t245) |
| 7 | 287 | 270 | 20 | 1 | 29,7 | vermelha (t263, t271, t281, t295, t296) |
| 8 | 287 | 280 | 6 | 1 | 26,8 | vermelha |
| 9 | 289 | 274 | 15 | 1 | 25,7 | vermelha |
| 10 | 288 | 278 | 5 | 0 | 20,5 | vermelha |
| 11 | 284 | 281 | 2 | 0 | 6,8 | vermelha |
| 12 | 287 | 280 | 6 | 0 | 14,9 | vermelha |
| 13 | 287 | 271 | 8 | 0 | 24,9 | vermelha |
| 14 | 287 | 275 | 9 | 0 | 22,2 | vermelha |
| 15 | 287 | 271 | 13 | 1 | 18,9 | vermelha |
| 16 | 287 | 271 | 5 | 0 | 13,0 | vermelha |
| 17 | 4 | 4 | 0 | 0 | 1,5 | verde |
| 18 | 1 | 1 | 0 | 0 | 18,6 | verde |
| 19 | 1 | 1 | 0 | 0 | 19,2 | verde |
| 20 | 1 | 1 | 0 | 1 | 55,0 | verde, na segunda tentativa |

- **"Rodaram"** é listados menos pulados e não iniciados, somados por spec. Limite de precisão: 19 pulos de quatro specs que caem em duas fatias (t14, t39, t46 e t151) não têm fatia certa, e uma falha do t14 está na fatia 1 ou na 16.
- **Tetos:** nenhuma fatia chegou perto do seu (65 min nas fatias 1–16, 100 min nas 17–20). O job mais longo levou 58,8 min (fatia 20).
- **Conferência dos totais:** `por_spec` soma 4.426 executados (4.272 + 140 + 6 instáveis + 8 falhas conhecidas). A completude diz 4.419. A diferença de 7 é o t337 (item 4.1): 3 testes rodaram sem estar na listagem e 4 listados não casam com nenhum teste da rodada.

## 4. Falhas de infra e de fatia

Nenhuma fatia se perdeu, nenhuma foi cortada, o Supabase subiu em todas e o registro no banco funcionou. Os defeitos abaixo são da própria suíte, não do produto.

### 4.1 O t337 impede a completude de chegar a zero

`tests/e2e/specs/t337-varredura-redundancia.spec.ts` monta a lista de testes a partir de `lerMassa()`, que lê `tests/laboratorio/saida/varredura.json`. Esse arquivo só existe depois do seed da fatia. No job `construir` ele não existe, então a listagem tem 24 testes (`inquilino 5: 3 telas`, `proprietario 5: 7 telas`…), e a fatia roda 27 (as rotas com id entram e mudam a contagem e os títulos).

Efeito: 4 "não executados" falsos em toda rodada (o documento de 12/11 já tinha notado "4 testes listados não rodaram" no t337) e 3 testes que rodam fora da conferência. **Mesmo com todas as falhas de teste corrigidas, o `consolidar` ficaria vermelho por completude.**

**Corrigido no Passo 1** (seção 7.1): a lista de testes do t337 sai de uma massa de listagem, igual no job que lista e na fatia que roda.

### 4.2 O resumo não tem números por fatia

O "resultado agregado legível" traz totais e a lista por spec, mas não diz quantos testes cada fatia tinha, quantos rodou e quanto demorou. Para a tabela da seção 3 foi preciso refazer o mapa à mão.

**Corrigido no Passo 1** (seção 7.1): o resumo do `consolidar` ganha a tabela "Por fatia (executados × listados)".

### 4.3 Fatia 20 com pouca folga

O teste do admin no `t48-varredura` estourou o tempo limite de 30 min na primeira tentativa e passou na segunda: 55 min de um teto de 100. Em 12/11 e 13/11 a fatia 20 também foi a mais longa. A proposta de dividir o admin em duas larguras ficou pendente em 09/11 (ver `docs/e744-suite-fatiada.md`, última nota), porque alterar o t48 faz o `lab-critico` rodar a cadeia inteira (cerca de 100 min num job de 40).

### 4.4 A noturna começa 7 a 9 h depois do agendado

Ver seção 2. É atraso do agendador do GitHub; a rodada em si não é afetada, mas o resultado "da noite" só existe no meio da tarde (UTC).

### 4.5 Os 84 não executados restantes

São testes de specs em modo serial que não começam depois que um teste anterior do mesmo spec falha (o Playwright marca o resto da cadeia como "did not run"). É a explicação do inventário de 12/11; nesta rodada conferi a soma (99 pulos em specs vermelhos, 79 em specs verdes, estes declarados), não os nomes um a um. Somem quando os specs vermelhos forem corrigidos.

## 5. Falhas de teste da noturna de 14/11 (140 falhas, 80 specs; 6 entradas instáveis)

| Grupo | Falhas | Specs | Leitura |
|---|---|---|---|
| Visual (t245, t271, t263) | 54 | 3 | Nunca tiveram rodada verde. Dependem do julgamento do Gerente, spec a spec (regra 2). |
| Rotas da Conta | 16 | 13 | Todos verdes em 12/11 e vermelhos desde 13/11 com o mesmo erro: esperam `/dashboard/conta/avaliacoes` e recebem `/dashboard/avaliacoes`, ou esperam `/dashboard/conta` e recebem `/dashboard/conta/perfil`. |
| Tempo esgotado (90 s) | 5 | 3 | t176 (2), t778 (2), t40 (1). O t176 já foi corrigido no #3830, depois desta noturna. |
| A triar | 65 | 61 | Uma ou duas falhas por spec. 41 nunca tiveram rodada verde; os outros 20 são regressões. |

Das 35 regressões: 13 são as rotas da Conta; 2 (t176 e t88) já foram corrigidas no #3830; as outras 20 são t11, t14, t38, t40, t64, t77, t79, t161, t186, t193, t195, t204, t281, t295, t296, t568, t683, t707, t800 e t840.

**Candidatos a falha de produto, pelo texto do erro** (nenhum reproduzido ainda; ver a seção 7 para o resultado da triagem):

- t11: "sobrenome do inquilino vazou no fio pré-aceite";
- t193: o valor 2.900 aparece onde não devia;
- t348: valor em R$ ou salário na tela de triagem;
- t79: privacidade do acesso;
- t281: o rascunho a excluir continua na tela;
- t840: pins sobrepostos no mapa;
- t597: pedido de limpeza não criado.

### Por spec

Colunas: fatia (reconstruída), falhas, instáveis, pulados/não iniciados no spec, data do último registro verde em `lab_execucoes` ("nunca" = nenhum registro verde), grupo e o começo do primeiro erro.

| Fatia | Spec | Falhou | Instável | Pulou | Último verde | Grupo | Primeiro erro |
|---|---|---|---|---|---|---|---|
| 1 | `t11-travessias` | 1 | 0 | 3 | 12/11 | a triar | sobrenome do inquilino vazou no fio pré-aceite expect(received).not.toContain(expected) // indexOf Expected substring: not "Lima" Received string: "@f |
| 1/16 | `t14-app-mode` | 1 | 0 | 11 | 12/11 | a triar | expect(locator).toBeVisible() failed Locator: locator('main').getByRole('link', { name: /^Perfil/ }) Expected: visible Timeout: 10000ms Error: element |
| 1 | `t1402-varredura-bloco480` | 1 | 0 | 0 | 12/11 | rotas da Conta | proprietário — Conta @1280: caiu fora da tela (login ou redirecionamento) expect(received).toBe(expected) // Object.is equality Expected: "/dashboard/ |
| 2 | `t1411-varredura-bloco489` | 1 | 0 | 0 | 12/11 | rotas da Conta | morador — Conta › Avaliações @1280: caiu fora da tela (login ou redirecionamento) expect(received).toBe(expected) // Object.is equality Expected: "/da |
| 2 | `t1439-varredura-bloco506` | 1 | 0 | 0 | 12/11 | rotas da Conta | morador — Conta › Avaliações @1280: caiu fora da tela (login ou redirecionamento) expect(received).toBe(expected) // Object.is equality Expected: "/da |
| 2 | `t1448-varredura-bloco514` | 1 | 0 | 0 | 12/11 | rotas da Conta | proprietário — Conta @1280: caiu fora da tela (login ou redirecionamento) expect(received).toBe(expected) // Object.is equality Expected: "/dashboard/ |
| 3 | `t161-coerencia-imovel` | 1 | 0 | 0 | 08/11 | a triar | expect(locator).toBeVisible() failed Locator: getByText('Indisponível').first() Expected: visible Timeout: 10000ms Error: element(s) not found Call lo |
| 3 | `t1461-varredura-bloco523` | 1 | 0 | 0 | 12/11 | rotas da Conta | morador — Conta › Avaliações @1280: caiu fora da tela (login ou redirecionamento) expect(received).toBe(expected) // Object.is equality Expected: "/da |
| 4 | `t176-exemplo-proprietario-avaliacoes` | 2 | 0 | 0 | 08/11 | tempo esgotado | Test timeout of 90000ms exceeded. |
| 4 | `t186-cadastro-5-etapas` | 1 | 0 | 1 | 07/11 | a triar | page.waitForURL: Timeout 30000ms exceeded. =========================== logs =========================== waiting for navigation until "load" navigated  |
| 4 | `t193-propostas` | 1 | 0 | 4 | 12/11 | a triar | expect(received).not.toMatch(expected) Expected pattern: not /(?<![\w-])2\.?900(?![\w-])/ Received string: "\"url\" parameter is not allowed @font-fac |
| 4 | `t195-matricula-caf` | 1 | 0 | 0 | 01/11 | a triar | expect(locator).toContainText(expected) failed Locator: getByTestId('matriculas-admin').getByTestId('matricula-card').filter({ hasText: 'Diana' }).fir |
| 4 | `t204-cadastro-ia-real` | 1 | 1 | 1 | 29/10 | a triar | expect(locator).toBeVisible() failed Locator: getByTestId('ia-fotos-falha') Expected: visible Timeout: 60000ms Error: element(s) not found Call log: - |
| 6 | `t245-visual-regressao` | 37 | 0 | 0 | nunca | visual | expect(page).toHaveScreenshot(expected) failed 27235 pixels (ratio 0.09 of all image pixels) are different. Snapshot: 01-home-390.png Call log: - Expe |
| 7 | `t29-chat-sem-aprovacao` | 0 | 1 | 0 | nunca | instável | expect(received).toBe(expected) // Object.is equality Expected: 0 Received: 1 |
| 7 | `t263-visual-41` | 6 | 0 | 7 | nunca | visual | expect(page).toHaveScreenshot(expected) failed Expected an image 390px by 11728px, received 390px by 13525px. 2328523 pixels (ratio 0.45 of all image  |
| 7 | `t271-admin-visual` | 11 | 0 | 0 | nunca | visual | expect(page).toHaveScreenshot(expected) failed 339217 pixels (ratio 0.30 of all image pixels) are different. Snapshot: t271-admin-1280.png Call log: - |
| 7 | `t281-minimizacao` | 1 | 0 | 2 | 12/11 | a triar | expect(locator).toHaveCount(expected) failed Locator: getByText('Rascunho a excluir iladdf') Expected: 0 Received: 1 Timeout: 15000ms Call log: - Expe |
| 7 | `t295-niveis-59-1` | 1 | 0 | 3 | 23/10 | a triar | expect(locator).not.toBeChecked() failed Locator: getByTestId('nivel-tenho-ar_sala') Expected: not checked Received: checked Timeout: 20000ms Call log |
| 7 | `t296-niveis-exibicao-59-1` | 1 | 0 | 4 | 23/10 | a triar | expect(locator).toContainText(expected) failed Locator: getByTestId('cartao-imovel').filter({ has: getByTestId('cartao-titulo').filter({ hasText: 'Stu |
| 8 | `t305-laudo-avaliacao-62b2` | 0 | 1 | 0 | nunca | instável | expect(locator).toContainText(expected) failed Locator: getByTestId('avaliacao-nova') Expected substring: "novo pedido, avaliador à sua escolha (outro |
| 8 | `t316-sair-da-viva-51` | 1 | 0 | 1 | nunca | a triar | expect(locator).toHaveAttribute(expected) failed Locator: locator('[data-testid="correcao"][data-papel="parceiro"][data-motivo="parei_servico"]') Expe |
| 8 | `t318-papel-ativo-fonte-unica` | 1 | 0 | 1 | nunca | a triar | expect(received).toBe(expected) // Object.is equality Expected: "proprietario" Received: "morador" Call Log: - Timeout 20000ms exceeded while waiting  |
| 8 | `t328-documento-sem-trava-l11` | 1 | 0 | 1 | nunca | a triar | expect(locator).toBeVisible() failed Locator: getByTestId('documento-enviar') Expected: visible Received: hidden Timeout: 20000ms Call log: - Expect " |
| 8 | `t331-preferencias-push-44b2` | 1 | 0 | 1 | nunca | a triar | expect(locator).toBeVisible() failed Locator: getByTestId('notif-categorias') Expected: visible Timeout: 30000ms Error: element(s) not found Call log: |
| 8 | `t346-importar-calendario-53` | 1 | 0 | 1 | nunca | a triar | expect(received).toBe(expected) // Object.is equality Expected: 1 Received: 0 Call Log: - Timeout 20000ms exceeded while waiting on the predicate |
| 8 | `t348-triagem-vinculo-52` | 1 | 0 | 0 | nunca | a triar | expect(received).not.toMatch(expected) Expected pattern: not /R\$\s?\d¦salári/i Received string: "<!DOCTYPE html><html lang=\"pt-BR\" class=\"Lrk39W_v |
| 9 | `t38-varios-imoveis-por-dono` | 1 | 0 | 0 | 23/10 | a triar | expect(locator).toBeVisible() failed Locator: getByText('Studio 21 do teste de vários imóveis lkeepk').first() Expected: visible Timeout: 20000ms Erro |
| 9 | `t40-novo-anuncio-fotos` | 1 | 0 | 1 | 23/10 | tempo esgotado | Test timeout of 90000ms exceeded. |
| 9 | `t352-varredura-bloco17` | 1 | 0 | 0 | 12/11 | rotas da Conta | inquilina — Conta (CONTA-A) @1280: caiu fora da tela (login ou redirecionamento) expect(received).toBe(expected) // Object.is equality Expected: "/das |
| 9 | `t353-varredura-bloco18` | 1 | 0 | 0 | 13/11 | rotas da Conta | inquilina — Conta @1280: caiu fora da tela (login ou redirecionamento) expect(received).toBe(expected) // Object.is equality Expected: "/dashboard/con |
| 9 | `t370-conta-a3-papeis` | 1 | 0 | 0 | nunca | a triar | locator.click: Timeout 20000ms exceeded. Call log: - waiting for getByTestId('papel-morar-toggle') - locator resolved to <button disabled type="button |
| 9 | `t385-varredura-bloco21` | 2 | 0 | 0 | 12/11 | rotas da Conta | inquilina — Conta Avaliações @1280: caiu fora da tela (login ou redirecionamento) expect(received).toBe(expected) // Object.is equality Expected: "/da |
| 9 | `t386-cadastro-01-tipo` | 1 | 0 | 2 | nunca | a triar | expect(locator).toHaveText(expected) failed Locator: getByTestId('previa-titulo') Expected: "Apartamento" Received: "Título ainda não definido" Timeou |
| 9 | `t388-varredura-bloco23` | 1 | 0 | 0 | nunca | a triar | inquilina — Contrato da estadia @1280 — clique: clique no botão primário sem resposta visível em 3 s expect(received).toEqual(expected) // deep equali |
| 9 | `t389-deteccao-fotos` | 0 | 1 | 0 | nunca | instável | expect(received).toBe(expected) // Object.is equality Expected: true Received: false Call Log: - Timeout 30000ms exceeded while waiting on the predica |
| 9 | `t392-varredura-bloco24` | 3 | 0 | 0 | 12/11 | rotas da Conta | inquilina — Avaliações (#1261, #1263) @1280: caiu fora da tela (login ou redirecionamento) expect(received).toBe(expected) // Object.is equality Expec |
| 9 | `t397-foto-na-hora` | 1 | 0 | 1 | nunca | a triar | expect(locator).toHaveText(expected) failed Locator: getByTestId('***').first() Expected: "Refaça a foto de Micro-ondas pela câmera até 24/11/2026" Ti |
| 9 | `t400-chacara-sem-internet` | 1 | 0 | 2 | nunca | a triar | expect(received).toBe(expected) // Object.is equality Expected: "nao_tem" Received: "radio" Call Log: - Timeout 30000ms exceeded while waiting on the  |
| 9 | `t401-cadastro-10-revisao` | 1 | 0 | 2 | nunca | a triar | expect(received).toBe(expected) // Object.is equality Expected: "Tudo certo para publicar" Received: "Falta: aceite do termo da IA" Call Log: - Timeou |
| 10 | `t405-perfil-e60-e62` | 1 | 0 | 0 | nunca | a triar | locator.waitFor: Timeout 20000ms exceeded. Call log: - waiting for getByTestId('fale-com-a-viva-raiz') to be visible 43 × locator resolved to hidden < |
| 10 | `t435-cadastro-03-endereco` | 1 | 0 | 2 | nunca | a triar | expect(received).toBe(expected) // Object.is equality Expected: true Received: false |
| 10 | `t442-foto-perfil-revisao` | 1 | 0 | 2 | nunca | a triar | expect(locator).toBeVisible() failed Locator: getByText('Fotos de perfil em revisão') Expected: visible Timeout: 20000ms Error: element(s) not found C |
| 10 | `t456-comodidades-tipo-e111a` | 1 | 0 | 1 | nunca | a triar | expect(locator).toBeVisible() failed Locator: getByText(/Salvo/).first() Expected: visible Timeout: 30000ms Error: element(s) not found Call log: - Ex |
| 10 | `t464-prop6-inicio-dono` | 1 | 0 | 5 | nunca | a triar | expect(locator).toBeVisible() failed Locator: getByTestId('inicio-dono-foto') Expected: visible Timeout: 10000ms Error: element(s) not found Call log: |
| 11 | `t465-admin4-inicial` | 1 | 0 | 1 | nunca | a triar | expect(locator).toHaveAttribute(expected) failed Locator: getByTestId('admin-decisoes') Expected: "2" Timeout: 30000ms Error: element(s) not found Cal |
| 11 | `t469-e134-passo4-alinhado` | 1 | 0 | 1 | nunca | a triar | tipo: botões vazando expect(received).toEqual(expected) // deep equality - Expected - 1 + Received + 12 - Array [] + Array [ + "11. Tipo do imóvel— pa |
| 12 | `t534-e147-bairro-santa-monica` | 1 | 0 | 1 | nunca | a triar | expect(locator).toHaveText(expected) failed Locator: getByTestId('passo-titulo') Expected: "Detalhes do imóvel" Received: "Adicione as fotos do imóvel |
| 12 | `t547-e148a-texto-sugerido-passo7` | 1 | 0 | 1 | nunca | a triar | expect(locator).toHaveValue(expected) failed Locator: getByTestId('cadastro-titulo') Expected: "Apartamento mobiliado de 2 quartos no Santa Mônica" Re |
| 12 | `t548-e132a-declaracoes-persistem` | 1 | 0 | 2 | nunca | a triar | expect(received).toMatchObject(expected) Matcher error: received value must be a non-null object Received has value: null Call Log: - Timeout 20000ms  |
| 12 | `t564-e193-qualificacao-cartoes` | 1 | 0 | 1 | nunca | a triar | expect(received).toBe(expected) // Object.is equality Expected: 23 Received: 0 |
| 12 | `t568-e176-parte2-conta` | 1 | 0 | 0 | 12/11 | a triar | expect(locator).toHaveAttribute(expected) failed Locator: getByTestId('conta-menu').getByRole('link', { name: /Segurança e verificações/ }) Expected:  |
| 12 | `t585-e205b-emails-novos` | 1 | 0 | 1 | nunca | a triar | expect(received).toMatch(expected) Expected pattern: /Abrir no mapa: https:\/\// Received string: "Remetente: Viva Nomads Brasil <suporte@vivanomads.c |
| 13 | `t64-telas-largas` | 1 | 0 | 0 | 23/10 | a triar | expect(locator).toBeVisible() failed Locator: getByTestId('novo-resumo') Expected: visible Timeout: 10000ms Error: element(s) not found Call log: - Ex |
| 13 | `t590-espaco-trabalho-interesse` | 1 | 0 | 2 | nunca | a triar | expect(locator).toHaveValue(expected) failed Locator: getByTestId('espaco-procura') Expected: "coworking" Received: "" Timeout: 30000ms Call log: - Ex |
| 13 | `t597-e213b-limpeza-renovacao` | 1 | 0 | 4 | nunca | a triar | um pedido por saída, mesmo com 2 rodadas expect(received).toHaveLength(expected) Expected length: 1 Received length: 0 Received array: [] |
| 13 | `t621-varredura-bloco55` | 2 | 0 | 0 | nunca | a triar | Início do dono novo, checklist dentro de "Anuncie seu primeiro imóvel" (E218) @1280: o checklist do dono (E218) aparece (InicioDono/primeiro_anuncio)  |
| 13 | `t622-varredura-bloco56` | 1 | 0 | 0 | nunca | a triar | proprietário — Meus imóveis com só um rascunho @390 — fixo: elemento fixo/flutuante sobre conteúdo que a rolagem não revela expect(received).toEqual(e |
| 13 | `t655-observador-botoes-filas` | 1 | 0 | 2 | nunca | a triar | expect(locator).toBeVisible() failed Locator: locator('[data-testid="fila-foto"][data-user="***"]').getByTestId('foto-aprovar') Expected: visible Time |
| 13 | `t656-e224-plano-gestor` | 1 | 0 | 1 | nunca | a triar | expect(locator).toHaveText(expected) failed Locator: getByTestId('***') Expected: "Liberado. Fale com a Viva para ativar." Received: "Plano Gestor: ta |
| 14 | `t661-varredura-bloco62` | 1 | 0 | 0 | 12/11 | rotas da Conta | proprietário — Conta, 'Conta' uma vez (E238) @1280: caiu fora da tela (login ou redirecionamento) expect(received).toBe(expected) // Object.is equalit |
| 14 | `t678-e202-emails-candidatura` | 1 | 0 | 0 | nunca | a triar | expect(locator).toHaveValue(expected) failed Locator: getByLabel(/Prazo total em meses/i) Expected: "1" Timeout: 20000ms Error: element(s) not found C |
| 14 | `t679-varredura-bloco70` | 1 | 0 | 0 | 12/11 | rotas da Conta | morador — Conta · avaliações @1280: caiu fora da tela (login ou redirecionamento) expect(received).toBe(expected) // Object.is equality Expected: "/da |
| 14 | `t683-e259-perto-fonte-unica` | 1 | 0 | 0 | 10/11 | a triar | expect(received).toBeLessThan(expected) Expected: < 650 Received: 843 |
| 14 | `t693-prova-de-publicacao` | 1 | 0 | 3 | nunca | a triar | expect(received).toBe(expected) // Object.is equality Expected: "publicou" Received: "esperando" Call Log: - Timeout 45000ms exceeded while waiting on |
| 14 | `t694-varredura-bloco73` | 1 | 0 | 0 | 12/11 | rotas da Conta | morador — Minha conta (#1575) @1280: caiu fora da tela (login ou redirecionamento) expect(received).toBe(expected) // Object.is equality Expected: "/d |
| 14 | `t696-varredura-bloco74` | 1 | 0 | 0 | nunca | a triar | Passo 10, Declarações do imóvel na conferência (#1587) @1280: a tela do merge aparece (conferencia-tipo) expect(locator).toBeVisible() failed Locator: |
| 14 | `t697-e259-pessoas-sugerido-grava` | 1 | 0 | 3 | nunca | a triar | expect(received).toBe(expected) // Object.is equality Expected: "6" Received: undefined Call Log: - Timeout 30000ms exceeded while waiting on the pred |
| 14 | `t707-e262-galeria-destaques-previa` | 1 | 0 | 5 | 12/11 | a triar | expect(received).toBe(expected) // Object.is equality Expected: "(max-width: 768px) 100vw, 50vw" Received: "(max-width: 768px) 100vw, 25vw" |
| 15 | `t77-comodidades` | 2 | 0 | 0 | 23/10 | a triar | expect(locator).toBeVisible() failed Locator: getByTestId('***').locator('h3').first() Expected: visible Timeout: 10000ms Error: element(s) not found  |
| 15 | `t79-privacidade-acesso` | 1 | 0 | 2 | 23/10 | a triar | expect(received).toContain(expected) // indexOf Expected substring: "Acesso: Fechadura com senha" Received string: "<!DOCTYPE html><html lang=\"pt-BR\ |
| 15 | `t735-e277-busca-parceiros-fotos` | 1 | 0 | 3 | nunca | a triar | locator.scrollIntoViewIfNeeded: Timeout 15000ms exceeded. Call log: - waiting for locator('[data-testid="cartao-parceiro"][data-slug="***"]') |
| 15 | `t739-varredura-parceiros-390` | 1 | 1 | 4 | nunca | a triar | expect(received).toBe(expected) // Object.is equality Expected: 0 Received: 6 Call Log: - Timeout 15000ms exceeded while waiting on the predicate |
| 15 | `t772-e329-visita-confirmada` | 2 | 0 | 0 | nunca | a triar | expect(locator).toBeAttached() failed Locator: getByTestId('visita-video-abrir').first() Expected: attached Timeout: 25000ms Error: element(s) not fou |
| 15 | `t778-e347-x-visita-video` | 2 | 0 | 0 | nunca | tempo esgotado | Test timeout of 90000ms exceeded. |
| 15 | `t799-cadastro-regras-icones` | 2 | 0 | 0 | nunca | a triar | expect(locator).toHaveCount(expected) failed Locator: getByTestId('regras-casa').locator('[data-ligado]').first().locator('[data-testid$=\'-icone\']') |
| 15 | `t800-cadastro-passo4-titulo` | 1 | 0 | 0 | 12/11 | a triar | expect(locator).toBeVisible() failed Locator: getByTestId('cartao-numeros') Expected: visible Timeout: 20000ms Error: element(s) not found Call log: - |
| 15 | `t816-cidade-bairros-grade-par` | 1 | 0 | 0 | nunca | a triar | expect(received).toBeLessThan(expected) Expected: < 580 Received: 1159.984375 |
| 16 | `t88-imovel-completo` | 1 | 0 | 0 | 22/10 | a triar | expect(received).toBeGreaterThanOrEqual(expected) Expected: >= 115 Received: -2895 |
| 16 | `t838-varredura-matriz-bloqueadas` | 1 | 0 | 0 | 12/11 | rotas da Conta | perfil-02-avaliacoes @1280: caiu fora da tela expect(received).toBe(expected) // Object.is equality Expected: "/dashboard/conta/avaliacoes" Received:  |
| 16 | `t840-e525-pins-sem-sobreposicao` | 1 | 0 | 0 | 12/11 | a triar | expect(received).toEqual(expected) // deep equality - Expected - 1 + Received + 4 Object { "foraDoMapa": Array [], - "sobre": Array [], + "sobre": Arr |
| 16 | `t886-e464-cabecalho-conta` | 1 | 0 | 1 | nunca | a triar | /dashboard/conta/perfil: sino expect(locator).toBeVisible() failed Locator: getByTestId('topo-parceiro').getByTestId('sino-parceiro') Expected: visibl |
| 16 | `t909-reembolso-linha-tablet` | 1 | 0 | 2 | nunca | a triar | expect(locator).toBeVisible() failed Locator: getByTestId('***') Expected: visible Timeout: 30000ms Error: element(s) not found Call log: - Expect "to |
| 17/18/19/20 | `t48-varredura` | 0 | 1 | 0 | nunca | instável | Test timeout of 1800000ms exceeded. |

## 6. O que falta para UMA rodada completa verde

**Ordem confirmada pelo Gerente em 15/11 (Decisão B), um PR draft por passo:**

| # | Passo | Depende do Gerente? | Estado |
|---|---|---|---|
| 1 | **Infra da suíte:** t337 com listagem estável (completude pode chegar a zero) e tabela de números por fatia no resumo do `consolidar`. Sem migração. Vem primeiro porque torna os passos seguintes mensuráveis. | não | **PR draft aberto** (seção 7.1) |
| 2 | **Rotas da Conta (13 specs):** é um aglomerado de REGRESSÃO (verde até 12/11; causa provável #3757/E801, a confirmar). Regressão passa à frente de falha que nunca foi verde. | não: é decisão registrada (E492/E552, E679, E798) | **pronto no local** (seção 7.2), à espera de branch (Dúvida 8) |
| 3 | **Triagem dos 61 specs "a triar" e dos 3 de tempo esgotado contra a main de HOJE**, com a rodada manual de 15/11 (run 43664453319) como base. Spec desatualizado corrige-se dentro da suíte. | os itens de produto | a fazer |
| 4 | **Visual (t245, t271, t263) por último:** diff de cada tela para o julgamento do Gerente, um a um. Nunca regravado em silêncio. | sim | a fazer (ver Dúvida 3) |
| 5 | As outras pernas da 9-segurança (detector no caminho do merge e checagem de base atual, desenho em `docs/e775-desenho-fila-de-merge.md`): **só depois do verde completo.** Até lá a checagem de base é feita à mão pela cadeia de merges do Gerente. | sim | depois |
| — | Rodada completa verde na main com tudo mesclado: é a prova de fecho. | sim (merge) | — |

**Emenda 1 (Gerente):** candidato a defeito de produto (t11, t193, t348, t79, t281, t840, t597, ou qualquer outro) que se REPRODUZIR como defeito do produto **sai da fila da suíte**: reporta-se com a evidência, o Gerente registra como item E na lista-master e encaminha à pista dona da área. Não se "conserta" defeito de produto ajustando o teste.

As outras duas pernas da Família 9-segurança, para registro:

- **Detector de verde que vira vermelho:** existe e funciona (`scripts/lab/detectar-regressoes.mjs` acusou as 35). Só vive dentro da noturna; nada avisa fora dela.
- **Base atual antes do merge:** não está na main. Nenhum workflow tem `merge_group`; só existe o desenho em `docs/e775-desenho-fila-de-merge.md`.

## 7. Triagem (resultado, atualizado a cada passo)

Cada passo entra aqui com o veredito (spec desatualizado / produto / infra / instável), a prova e o que foi feito.

### 7.1 Passo 1 — infra da suíte (PR draft aberto em 15/11)

| O quê | Como | Prova |
|---|---|---|
| **t337 com listagem estável** | A regra das rotas saiu do spec para `tests/e2e/fixtures/rotas-redundancia.ts`. O spec monta os testes com `MASSA_DE_LISTAGEM` (ids fictícios, mesma quantidade de rotas) e só troca pelos ids de verdade dentro do teste. Os títulos ficam iguais aos que a fatia já rodava (27 testes), então o histórico em `lab_execucoes` continua. Sem a massa na fatia, o grupo com rota de id reprova dizendo o que falta (antes mudava de tamanho em silêncio). | Listagem da suíte inteira, sem a massa (como o `construir`) contra com a massa (como a fatia). **Antes:** 4.659 × 4.662, 4 listados que a fatia não roda (`admin 8: 3 telas`, `inquilino 5: 3 telas`, `proprietario 5: 7 telas`, `publico 5: 4 telas`) e 7 que rodam fora da listagem. **Depois:** 4.662 × 4.662, 0 e 0. O t337 foi o único spec da suíte com esse defeito. No laboratório local: `27 passed (11.7m)`. |
| **Completude nos dois sentidos** | `scripts/lab/conferir-completude.mjs` passa a reprovar também o teste que RODOU e não está na listagem (`fora da listagem N` no resumo), com a explicação da causa. É aperto de fasquia, não afrouxamento. | Testes de guarda (3 casos). Com o t337 corrigido o número esperado é 0. |
| **Números por fatia no resumo** | `scripts/lab/numeros-por-fatia.mjs` lê o `resultado.json` de cada artifact e escreve uma linha por fatia: listados, executados, passaram, falharam, instáveis, pulados de propósito, não iniciados, minutos da suíte e veredito (verde, vermelha, incompleta, sem resultado). Entra no "Resumo da noite". Não grava no banco (sem migração). | Testes de guarda (3 casos) e execução sobre relatórios reais. A primeira tabela de verdade sai na primeira noturna depois do merge. |
| **Erro completo no log da fatia** (acrescentado em 15/11, 12:40 UTC) | `scripts/lab/falhas-da-fatia.mjs` + um passo no job da fatia, depois da suíte e antes do veredito: imprime os números da fatia e cada falha com o erro inteiro (até 2.000 caracteres, mesmas máscaras do resumo). O banco continua com 300 caracteres. | Nasceu de uma necessidade medida: na rodada manual o nome do elemento que cobre o cartão da busca veio cortado ("(butt…") e os artifacts não são legíveis desta sessão. Testes de guarda (3 casos). |

Guarda: `tests/laboratorio/e744-infra-da-suite.test.ts` (12 testes). Suíte unitária inteira: 7.533 testes, 7.532 passam, 0 falham, 1 pulado (medida antes do acréscimo do log; repetida no fecho).

**CI do PR #3832 na primeira rodada (commit `7d519d06`): tudo verde** — `verify`, `lab-critico` (18 min 44 s, com o t337 inteiro) e `e2e`.


### 7.2 Passo 2 — rotas da Conta (pronto no local; ver Dúvida 8 sobre o branch)

**Veredito: spec desatualizado, não produto.** Os dois redirecionamentos são decisão registrada no código:

- E492/E552: no computador (≥ 1024 px), `/dashboard/conta` abre o Perfil (`/dashboard/conta/perfil`); no celular é o menu.
- E679 (E85): `/dashboard/conta/avaliacoes` virou `/dashboard/avaliacoes`.

**Causa da regressão:** o E798 (commit `efeac8e7`, 12/11 18:11 UTC, depois da noturna de 12/11) passou os dois redirecionamentos para o servidor (`proxy`), antes de desenhar. As varreduras abriam o endereço antigo e cobravam "continuo neste endereço" logo depois do carregamento. Enquanto o redirecionamento era no navegador, a cobrança passava por corrida. O servidor só redireciona `/dashboard/conta` quando o cookie da largura (`vn-tela`) já existe; por isso 13 specs ficaram vermelhos e outros 4 (t279, t354, t607, t1423), com a mesma cobrança, passam só pela ordem das telas.

**Correção (só na suíte):** `tests/e2e/fixtures/destino-da-conta.ts` dá o caminho esperado pela mesma função que o proxy usa (`redirecionamentoDaConta`), e as 17 varreduras esperam a tela assentar (`expect.poll`) nesse caminho. Nenhuma tela saiu da varredura e nenhuma cobrança das seis classes mudou. Guarda: `tests/laboratorio/e744-rotas-da-conta.test.ts`.

**Prova no laboratório local** (main `c950ec82` + o Passo 2):

- As 17 varreduras inteiras, 2 workers, 1 nova tentativa: `217 passed, 1 flaky (25.3m)`.
- O instável (t1448, Conta a 1280 px) acusou `requisição falhou (fetch POST, net::ERR_ABORTED): /dashboard/conta/perfil`. Causa reproduzida na primeira tentativa: sem o cookie da largura, a casca dispara uma ação do servidor em `/dashboard/conta`; o proxy responde 307 para `/dashboard/conta/perfil`; a troca de tela do navegador cancela o salto. O Playwright não repete o cabeçalho `next-action` no salto redirecionado, e a varredura não reconhecia ali a "ação do servidor cancelada pela navegação" (regra do Muse de 22/10). Correção na fixture: `cabecalhosComOrigem` sobe a cadeia de redirecionamentos (3 testes de guarda em `requisicao-cancelada.test.ts`).
- Depois da correção, só as telas da Conta e de Avaliações das 17 varreduras, 3 vezes cada, **sem** nova tentativa: `315 passed (36.8m)`, 0 falhas.

**Observação de produto para o Gerente (não corrigida aqui; é da minha área, `proxy.ts`):** o redirecionamento do E798 vale para qualquer método. Uma ação do servidor (POST) disparada em `/dashboard/conta` no computador é redirecionada com 307 para o Perfil. Funciona (a resposta do salto é 200), mas é um pedido a mais e, quando a tela troca no meio, um pedido cancelado. Sequência medida: `POST /dashboard/conta [next-action]` → `307` → `POST /dashboard/conta/perfil` → `net::ERR_ABORTED`. Se o Gerente quiser, vira item: o proxy só redirecionar navegação (GET/HEAD).

**Tempo no portão:** as 17 varreduras levam 25,3 min no laboratório local. O passo do portão tem 25 min para elas mais a lista crítica; ver Dúvida 9.

### 7.3 Passo 3 — triagem contra a main de hoje (rodada local feita; investigação por grupo em curso)

Base: a rodada manual de 15/11 (seção 2.1). No laboratório local com banco novo rodaram os 82 specs vermelhos (ou instáveis) que não são visuais nem das rotas da Conta: 2 workers, 1 nova tentativa, 90 s por teste, main `c950ec82`, 12:27 → 14:13 UTC de 15/11. O `t48-varredura` (cadeia de até 100 min, verde no CI) foi interrompido de propósito; ficam 81.

**Resultado local:** 302 testes passaram, 74 falharam, 2 instáveis, 87 não iniciaram (cadeias em série depois de uma falha), 14 pulados de propósito.

| Situação | Specs | O que significa |
|---|---|---|
| Vermelho no CI **e** no local, com o mesmo erro | **66** | A falha é determinística e dá para investigar aqui. Em 63 dos 66 o começo do erro local é igual ao do CI. |
| Vermelho no CI, verde no local | 11 | 8 são a busca a 390 px (ver abaixo); t14 e t800 passaram aqui; t389 é instável. |
| Verde nos dois (instável ou já corrigido) | 4 | t29, t305 (instáveis em 14/11), t88 e t176 (corrigidos no #3830). |

**Busca a 390 px (t274, t368, t412, t419, t732, t1405, t1426, t1451 e parte do t1423): não reproduz neste ambiente.** O contêiner desta sessão não alcança os hosts de mapa (o proxy recusou 162 conexões a `www.google.com` durante a rodada); no CI a rede é aberta. A hipótese é que, com o mapa carregado, um botão fixo fica sobre o cartão a 390 px. Não está provada: o nome do botão vem cortado no banco. O "erro completo no log da fatia" (Passo 1) resolve isso na primeira rodada depois do merge. **Não mexo nesses specs antes de ler o erro inteiro.** Entrou com o #3831 (verdes em 14/11): é regressão e tem prioridade assim que for legível.

**Ressalva do ambiente local:** teste que depende de host externo (mapa, por exemplo) pode se comportar diferente aqui. Nos 66 que reproduzem, o erro local igual ao do CI afasta essa dúvida.

**Agrupamento preliminar dos 77 specs (66 + 11), pelo fluxo que testam.** Ainda não é veredito: cada grupo é investigado no código antes de qualquer correção.

| Grupo | Specs | Pista de causa (a confirmar) |
|---|---|---|
| Assistente de anúncio (cadastro do imóvel) | 25 | Poucas causas para muitos specs. Os erros falam de ordem dos passos ("Detalhes do imóvel" esperado, "Adicione as fotos do imóvel" recebido), de "Falta: aceite do termo da IA" na revisão e de campos que não gravam. |
| Flutuante na busca (E931) | 3 | Spec desatualizado por decisão registrada (t10, t244, t436). |
| Identidade ou valor "no fio" | 4 | t11, t193, t348, t79 leem TODAS as respostas da página (HTML, CSS, JS). O texto recebido começa pelo CSS do site. Falta provar se o achado está num arquivo estático (falso positivo) ou numa resposta com dado do usuário (defeito de produto). O site tem "Lima" em arquivos estáticos: 8 municípios do IBGE e dados de demonstração ("Rafael Lima", "Carlos Lima"); a persona do laboratório é "Ana Lima". |
| Busca a 390 px | 8 | Ver acima. |
| Avulsos | 37 | Um a um. |

Tabela completa (falhas no CI, falhas no local, situação, grupo e o começo do erro; o erro é o local quando reproduz):

| Spec | CI | Local | Situação | Grupo | Erro |
|---|---|---|---|---|---|
| `t10-buscar-url` | 1 | 1 | reproduz | flutuante na busca (E931) | expect(locator).toBeHidden() failed Locator: getByTestId('fale-com-a-viva') Expected: hidden Received: visible Timeout: 10000ms |
| `t11-travessias` | 1 | 1 | reproduz | identidade/valor no fio | sobrenome do inquilino vazou no fio pré-aceite expect(received).not.toContain(expected) // indexOf Expected substring: not "Lima" Received string: "@f |
| `t38-varios-imoveis-por-dono` | 1 | 1 | reproduz | assistente de anúncio | expect(locator).toBeVisible() failed Locator: getByText('Studio 21 do teste de vários imóveis padcle').first() Expected: visible Timeout: 20000ms Erro |
| `t40-novo-anuncio-fotos` | 1 | 1 | reproduz | assistente de anúncio | Test timeout of 90000ms exceeded. |
| `t64-telas-largas` | 1 | 1 | reproduz | assistente de anúncio | expect(locator).toBeVisible() failed Locator: getByTestId('novo-resumo') Expected: visible Timeout: 10000ms Error: element(s) not found |
| `t77-comodidades` | 2 | 2 | reproduz | avulso | expect(locator).toBeVisible() failed Locator: getByTestId('comodidades-lista-completa').locator('h3').first() Expected: visible Timeout: 10000ms Error |
| `t79-privacidade-acesso` | 1 | 1 | reproduz | identidade/valor no fio | expect(received).toContain(expected) // indexOf Expected substring: "Acesso: Fechadura com senha" Received string: "<!DOCTYPE html><html lang=\"pt-BR\ |
| `t161-coerencia-imovel` | 1 | 1 | reproduz | avulso | expect(locator).toBeVisible() failed Locator: getByText('Indisponível').first() Expected: visible Timeout: 10000ms Error: element(s) not found |
| `t186-cadastro-5-etapas` | 1 | 1 | reproduz | assistente de anúncio | page.waitForURL: Timeout 30000ms exceeded. =========================== logs =========================== waiting for navigation until "load" navigated  |
| `t193-propostas` | 1 | 1 | reproduz | identidade/valor no fio | expect(received).not.toMatch(expected) Expected pattern: not /(?<![\w-])2\.?900(?![\w-])/ Received string: "@font-face{font-family:inter;src:url(../me |
| `t195-matricula-caf` | 1 | 1 | reproduz | avulso | expect(locator).toContainText(expected) failed Locator: getByTestId('matriculas-admin').getByTestId('matricula-card').filter({ hasText: 'Diana' }).fir |
| `t204-cadastro-ia-real` | 1 | 1 | reproduz | assistente de anúncio | expect(locator).toBeVisible() failed Locator: getByTestId('ia-fotos-falha') Expected: visible Timeout: 60000ms Error: element(s) not found |
| `t228-contato-vai-para-ajuda` | 3 | 3 | reproduz | avulso | expect(received).toBe(expected) // Object.is equality Expected: "/ajuda" Received: "/ajuda/fale-com-a-viva" |
| `t244-fundacao-visual` | 1 | 1 | reproduz | flutuante na busca (E931) | expect(locator).toBeHidden() failed Locator: getByTestId('fale-com-a-viva') Expected: hidden Received: visible Timeout: 10000ms |
| `t281-minimizacao` | 1 | 1 | reproduz | assistente de anúncio | expect(locator).toHaveCount(expected) failed Locator: getByText('Rascunho a excluir ielnpd') Expected: 0 Received: 1 Timeout: 15000ms |
| `t295-niveis-59-1` | 1 | 1 | reproduz | assistente de anúncio | expect(locator).not.toBeChecked() failed Locator: getByTestId('nivel-tenho-ar_sala') Expected: not checked Received: checked Timeout: 20000ms |
| `t296-niveis-exibicao-59-1` | 1 | 1 | reproduz | assistente de anúncio | expect(locator).toContainText(expected) failed Locator: getByTestId('cartao-imovel').filter({ has: getByTestId('cartao-titulo').filter({ hasText: 'Stu |
| `t316-sair-da-viva-51` | 1 | 1 | reproduz | avulso | expect(locator).toHaveAttribute(expected) failed Locator: locator('[data-testid="correcao"][data-papel="parceiro"][data-motivo="parei_servico"]') Expe |
| `t318-papel-ativo-fonte-unica` | 1 | 1 | reproduz | avulso | expect(received).toBe(expected) // Object.is equality Expected: "proprietario" Received: "morador" |
| `t328-documento-sem-trava-l11` | 1 | 1 | reproduz | assistente de anúncio | expect(locator).toBeVisible() failed Locator: getByTestId('documento-enviar') Expected: visible Received: hidden Timeout: 20000ms |
| `t331-preferencias-push-44b2` | 1 | 1 | reproduz | avulso | expect(locator).toBeVisible() failed Locator: getByTestId('notif-categorias') Expected: visible Timeout: 30000ms Error: element(s) not found |
| `t346-importar-calendario-53` | 1 | 1 | reproduz | avulso | expect(received).toBe(expected) // Object.is equality Expected: 1 Received: 0 |
| `t348-triagem-vinculo-52` | 1 | 1 | reproduz | identidade/valor no fio | expect(received).not.toMatch(expected) Expected pattern: not /R\$\s?\d¦salári/i Received string: "<!DOCTYPE html><html lang=\"pt-BR\" class=\"Lrk39W_v |
| `t370-conta-a3-papeis` | 1 | 1 | reproduz | avulso | locator.click: Timeout 20000ms exceeded. |
| `t386-cadastro-01-tipo` | 1 | 1 | reproduz | assistente de anúncio | expect(locator).toHaveText(expected) failed Locator: getByTestId('previa-titulo') Expected: "Apartamento" Received: "Título ainda não definido" Timeou |
| `t388-varredura-bloco23` | 1 | 1 | reproduz | avulso | inquilina — Contrato da estadia @390 — clique: clique no botão primário sem resposta visível em 3 s expect(received).toEqual(expected) // deep equalit |
| `t397-foto-na-hora` | 1 | 1 | reproduz | avulso | expect(locator).toHaveText(expected) failed Locator: getByTestId('melhorar-refazer_foto_cozinha_microondas').first() Expected: "Refaça a foto de Micro |
| `t400-chacara-sem-internet` | 1 | 1 | reproduz | assistente de anúncio | expect(received).toBe(expected) // Object.is equality Expected: "nao_tem" Received: "radio" |
| `t401-cadastro-10-revisao` | 1 | 1 | reproduz | assistente de anúncio | expect(received).toBe(expected) // Object.is equality Expected: "Tudo certo para publicar" Received: "Falta: aceite do termo da IA" |
| `t405-perfil-e60-e62` | 1 | 1 | reproduz | avulso | AuthRetryableFetchError: {} |
| `t435-cadastro-03-endereco` | 1 | 1 | reproduz | assistente de anúncio | expect(received).toBe(expected) // Object.is equality Expected: true Received: false |
| `t436-busca-clean-e82` | 1 | 1 | reproduz | flutuante na busca (E931) | expect(locator).toHaveCount(expected) failed Locator: getByRole('button', { name: /Fale com a Viva/ }) Expected: 0 Received: 1 Timeout: 10000ms |
| `t442-foto-perfil-revisao` | 1 | 1 | reproduz | avulso | expect(locator).toBeVisible() failed Locator: getByText('Fotos de perfil em revisão') Expected: visible Timeout: 20000ms Error: element(s) not found |
| `t456-comodidades-tipo-e111a` | 1 | 1 | reproduz | assistente de anúncio | expect(locator).toBeVisible() failed Locator: getByText(/Salvo/).first() Expected: visible Timeout: 30000ms Error: element(s) not found |
| `t464-prop6-inicio-dono` | 1 | 1 | reproduz | assistente de anúncio | expect(locator).toBeVisible() failed Locator: getByTestId('inicio-dono-foto') Expected: visible Timeout: 10000ms Error: element(s) not found |
| `t465-admin4-inicial` | 1 | 1 | reproduz | avulso | expect(locator).toHaveAttribute(expected) failed Locator: getByTestId('admin-decisoes') Expected: "2" Timeout: 30000ms Error: element(s) not found |
| `t469-e134-passo4-alinhado` | 1 | 1 | reproduz | assistente de anúncio | tipo: botões vazando expect(received).toEqual(expected) // deep equality - Expected - 1 + Received + 12 - Array [] + Array [ + "11. Tipo do imóvel— pa |
| `t534-e147-bairro-santa-monica` | 1 | 1 | reproduz | assistente de anúncio | expect(locator).toHaveText(expected) failed Locator: getByTestId('passo-titulo') Expected: "Detalhes do imóvel" Received: "Adicione as fotos do imóvel |
| `t547-e148a-texto-sugerido-passo7` | 1 | 1 | reproduz | assistente de anúncio | expect(locator).toHaveValue(expected) failed Locator: getByTestId('cadastro-titulo') Expected: "Apartamento mobiliado de 2 quartos no Santa Mônica" Re |
| `t548-e132a-declaracoes-persistem` | 1 | 1 | reproduz | assistente de anúncio | expect(received).toMatchObject(expected) Matcher error: received value must be a non-null object Received has value: null |
| `t564-e193-qualificacao-cartoes` | 1 | 1 | reproduz | assistente de anúncio | expect(received).toBe(expected) // Object.is equality Expected: 23 Received: 0 |
| `t568-e176-parte2-conta` | 1 | 1 | reproduz | avulso | expect(locator).toHaveAttribute(expected) failed Locator: getByTestId('conta-menu').getByRole('link', { name: /Segurança e verificações/ }) Expected:  |
| `t574-e207-voltar-resultados` | 1 | 1 | reproduz | avulso | expect(received).toBe(expected) // Object.is equality Expected: true Received: false |
| `t585-e205b-emails-novos` | 1 | 1 | reproduz | avulso | expect(received).toMatch(expected) Expected pattern: /Abrir no mapa: https:\/\// Received string: "Remetente: Viva Nomads Brasil <suporte@vivanomads.c |
| `t590-espaco-trabalho-interesse` | 1 | 1 | reproduz | avulso | expect(locator).toHaveValue(expected) failed Locator: getByTestId('espaco-procura') Expected: "coworking" Received: "" Timeout: 30000ms |
| `t597-e213b-limpeza-renovacao` | 1 | 1 | reproduz | avulso | um pedido por saída, mesmo com 2 rodadas expect(received).toHaveLength(expected) Expected length: 1 Received length: 0 Received array: [] |
| `t621-varredura-bloco55` | 2 | 2 | reproduz | avulso | Início do dono novo, checklist dentro de "Anuncie seu primeiro imóvel" (E218) @1280: o checklist do dono (E218) aparece (InicioDono/primeiro_anuncio)  |
| `t622-varredura-bloco56` | 1 | 1 | reproduz | avulso | proprietário — Meus imóveis com só um rascunho @390 — fixo: elemento fixo/flutuante sobre conteúdo que a rolagem não revela expect(received).toEqual(e |
| `t655-observador-botoes-filas` | 1 | 1 | reproduz | avulso | expect(locator).toBeVisible() failed Locator: locator('[data-testid="fila-foto"][data-user=":id"]').getByTestId('foto-aprovar') Expected: visible Time |
| `t656-e224-plano-gestor` | 1 | 1 | reproduz | avulso | expect(locator).toHaveText(expected) failed Locator: getByTestId('conta-plano-gestor-texto') Expected: "Liberado. Fale com a Viva para ativar." Receiv |
| `t678-e202-emails-candidatura` | 1 | 1 | reproduz | avulso | expect(locator).toHaveValue(expected) failed Locator: getByLabel(/Prazo total em meses/i) Expected: "1" Timeout: 20000ms Error: element(s) not found |
| `t683-e259-perto-fonte-unica` | 1 | 1 | reproduz | avulso | expect(received).toBeLessThan(expected) Expected: < 650 Received: 924 |
| `t693-prova-de-publicacao` | 1 | 1 | reproduz | assistente de anúncio | expect(received).toBe(expected) // Object.is equality Expected: "publicou" Received: "esperando" |
| `t696-varredura-bloco74` | 1 | 1 | reproduz | assistente de anúncio | Passo 10, Declarações do imóvel na conferência (#1587) @1280: a tela do merge aparece (conferencia-tipo) expect(locator).toBeVisible() failed Locator: |
| `t697-e259-pessoas-sugerido-grava` | 1 | 1 | reproduz | assistente de anúncio | expect(received).toBe(expected) // Object.is equality Expected: "6" Received: undefined |
| `t707-e262-galeria-destaques-previa` | 1 | 1 | reproduz | avulso | expect(received).toBe(expected) // Object.is equality Expected: "(max-width: 768px) 100vw, 50vw" Received: "(max-width: 768px) 100vw, 25vw" |
| `t735-e277-busca-parceiros-fotos` | 1 | 1 | reproduz | avulso | locator.scrollIntoViewIfNeeded: Timeout 15000ms exceeded. |
| `t739-varredura-parceiros-390` | 1 | 1 | reproduz | avulso | expect(locator).toBeVisible() failed Locator: locator('[data-testid="cartao-parceiro"][data-slug="lia-limpeza-t739-jclimd"]') Expected: visible Timeou |
| `t772-e329-visita-confirmada` | 2 | 2 | reproduz | avulso | expect(locator).toBeAttached() failed Locator: getByTestId('visita-video-abrir').first() Expected: attached Timeout: 25000ms Error: element(s) not fou |
| `t778-e347-x-visita-video` | 2 | 2 | reproduz | avulso | Test timeout of 90000ms exceeded. |
| `t799-cadastro-regras-icones` | 2 | 2 | reproduz | assistente de anúncio | expect(locator).toHaveCount(expected) failed Locator: getByTestId('regras-casa').locator('[data-ligado]').first().locator('[data-testid$=\'-icone\']') |
| `t815-404-perfil-toque` | 1 | 1 | reproduz | avulso | expect(received).toBeGreaterThanOrEqual(expected) Expected: >= 44 Received: 32 |
| `t816-cidade-bairros-grade-par` | 1 | 1 | reproduz | avulso | expect(received).toBeLessThan(expected) Expected: < 580 Received: 1159.984375 |
| `t840-e525-pins-sem-sobreposicao` | 1 | 1 | reproduz | avulso | depois de Zoom out depois de Zoom out expect(received).toEqual(expected) // deep equality - Expected - 1 + Received + 10 Object { "foraDoMapa": Array  |
| `t886-e464-cabecalho-conta` | 1 | 1 | reproduz | avulso | /dashboard/conta/perfil: sino expect(locator).toBeVisible() failed Locator: getByTestId('topo-parceiro').getByTestId('sino-parceiro') Expected: visibl |
| `t909-reembolso-linha-tablet` | 1 | 1 | reproduz | avulso | expect(locator).toBeVisible() failed Locator: getByTestId('reembolso-linha-desconto') Expected: visible Timeout: 30000ms Error: element(s) not found |
| `t14-app-mode` | 1 | 0 | só no CI | avulso | expect(locator).toBeVisible() failed Locator: locator('main').getByRole('link', { name: /^Perfil/ }) Expected: visible Timeout: 10000ms Error: element |
| `t274-varredura-paginas` | 1 | 0 | só no CI | busca a 390 px | Buscar @390 — fixo: elemento fixo/flutuante sobre conteúdo que a rolagem não revela (/buscar) expect(received).toEqual(expected) // deep equality - Ex |
| `t368-varredura-bloco20` | 1 | 0 | só no CI | busca a 390 px | visitante — Buscar @390 — fixo: elemento fixo/flutuante sobre conteúdo que a rolagem não revela expect(received).toEqual(expected) // deep equality -  |
| `t389-deteccao-fotos` | 1 | 0 | só no CI | avulso | expect(received).toBe(expected) // Object.is equality Expected: true Received: false |
| `t412-varredura-bloco29` | 1 | 0 | só no CI | busca a 390 px | visitante — Buscar, busca limpa (#1313) @390 — fixo: elemento fixo/flutuante sobre conteúdo que a rolagem não revela expect(received).toEqual(expected |
| `t419-varredura-bloco36` | 2 | 0 | só no CI | busca a 390 px | visitante — Busca, barra de pílulas e painel de filtros (#1351) @390 — fixo: elemento fixo/flutuante sobre conteúdo que a rolagem não revela expect(re |
| `t732-conformidade-busca` | 1 | 0 | só no CI | busca a 390 px | busca 390 — elemento fixo/flutuante sobre conteúdo que a rolagem não revela expect(received).toEqual(expected) // deep equality - Expected - 1 + Recei |
| `t800-cadastro-passo4-titulo` | 1 | 0 | só no CI | assistente de anúncio | expect(locator).toBeVisible() failed Locator: getByTestId('cartao-numeros') Expected: visible Timeout: 20000ms Error: element(s) not found |
| `t1405-varredura-bloco483` | 1 | 0 | só no CI | busca a 390 px | visitante — Buscar @390 — fixo: elemento fixo/flutuante sobre conteúdo que a rolagem não revela expect(received).toEqual(expected) // deep equality -  |
| `t1426-varredura-bloco500` | 1 | 0 | só no CI | busca a 390 px | visitante — Buscar @390 — fixo: elemento fixo/flutuante sobre conteúdo que a rolagem não revela expect(received).toEqual(expected) // deep equality -  |
| `t1451-varredura-bloco517` | 1 | 0 | só no CI | busca a 390 px | visitante — Buscar @390 — fixo: elemento fixo/flutuante sobre conteúdo que a rolagem não revela expect(received).toEqual(expected) // deep equality -  |

**Próximo dentro do Passo 3:** (1) flutuante na busca; (2) identidade/valor no fio, com a prova de onde está o achado; (3) assistente de anúncio, pela causa comum; (4) avulsos. Um PR draft por grupo coerente, respeitando o tempo do portão.

### 7.4 Classificação das 96 specs (Prompt A) — primeira passada completa em 15/11

Arquivo: `docs/e744-classificacao-96-specs.md`. Resultado depois das rodadas isoladas (3 vezes cada, sem nova tentativa): **62 teste velho, 32 defeito real, 1 infra/tempo, 1 instável**; 26 com a Fable, 43 para a Code 2, 27 para o Gerente encaminhar; 17 itens novos de defeito real.

- **Achado urgente (t281):** excluir rascunho de anúncio falha para qualquer dono desde o #3595 (13/11), também em produção. Detalhe na seção 2 daquele arquivo.
- A `main` avançou para `403858f7` (#3833, 06:34 UTC de 15/11): o flutuante saiu de novo da `/buscar`. O branch do PR está sobre ela.
- Como foi feito, o que rodou e os limites: seções 7 e 8 daquele arquivo.
- **O que falta:** conferir os 8 specs da busca a 390 px na próxima rodada completa; o julgamento visual; os bisects marcados como pendentes; um branch para o PR das rotas da Conta (Dúvida 8).

## 8. Dúvidas (por extenso)

1. **Rodada na main de hoje. RESPONDIDA (Decisão A, 15/11): disparar à mão, agora.** Disparada às 01:43 UTC de 15/11: run [43664453319](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/actions/runs/43664453319), `workflow_dispatch`, main `c950ec82` (já com o #3831). O resultado entra na seção 7 e passa a ser a base da triagem.
2. **Rotas da Conta.** Os 13 specs esperam `/dashboard/conta` e `/dashboard/conta/avaliacoes`; o site hoje leva a `/dashboard/conta/perfil` e `/dashboard/avaliacoes`. Vou procurar a decisão no código e nos documentos (o candidato é o E801, #3757, mesclado em 13/11). Leitura conservadora: só alinho os specs se a decisão estiver registrada; se não achar o registro, o grupo volta como item.
3. **Como apresentar o diff visual.** Esta sessão não consegue baixar artifacts do GitHub (o proxy recusa o host dos arquivos), e o contêiner não reproduz as referências do laboratório (em 14/11, 24 de 26 telas públicas falhavam aqui com a main sem mudança nenhuma). O diff confiável (esperado, obtido e diferença) está no `playwright-report` das fatias 6 e 7 de cada noturna. Proposta: um passo no `consolidar` que copia as imagens de diff dos specs visuais para um artifact pequeno e nomeado, e eu descrevo tela a tela o que mudou a partir do código (qual PR mexeu em quê). Serve assim, ou o Gerente prefere que as imagens entrem no PR (por exemplo em `docs/capturas/e744-visual/`), o que exige um workflow com permissão de escrita no branch?
4. **Fatia 20 (admin da varredura t48).** Passou na segunda tentativa, 55 min. Dividir o admin em duas larguras exige alterar o `t48-varredura.spec.ts`, e o `lab-critico` roda inteiro todo spec alterado (cerca de 100 min num job de 40). A decisão ficou pendente em 09/11: (a) o portão deixa de rodar o t48 inteiro quando só ele muda, ou (b) fica como está, com o risco de a fatia 20 falhar por tempo numa noite ruim. Leitura conservadora: não mexo no t48 nem no portão sem resposta.
5. **Correção de specs fora das minhas áreas fixas.** Muitos specs vermelhos são de fluxos de outras pistas (cadastro de imóvel, parceiros, admin). Leitura conservadora: corrijo só o **arquivo de teste** quando ele estiver desatualizado em relação a uma decisão registrada; não toco em código de produto fora das minhas áreas, e o que for falha de produto volta como item.
6. **Atraso do agendamento (7 a 9 h).** Aceita-se, ou a noturna deve ter um segundo horário de cron como reserva? Não mexo sem resposta.
7. **"12 de 20 fatias verdes". RESPONDIDA (15/11):** o número vinha do monitor do Gerente, cego desde 13/11. Valem os números lidos das rodadas (12/11: 8 de 20; 13/11: 5; 14/11: 5).
   **Atualização (15/11, 12:30 UTC):** pedi a liberação do host dos artifacts e ela foi aprovada para `productionresultssa32.blob.core.windows.net`, mas o host muda de arquivo para arquivo (o da rodada manual saiu em `productionresultssa13…`). A ferramenta só aceita nomes exatos; o padrão `*.blob.core.windows.net` só pode ser posto nas configurações do ambiente, pelo dono. Com o padrão liberado, eu leio o `playwright-report` (esperado, obtido e diferença de cada tela) e apresento os diffs sem mexer em workflow. Sem ele, vale a proposta acima. O host `…sa32…` pode ser retirado; não serve sozinho.
8. **Branch para cada passo.** A regra desta sessão me deixa empurrar só para `claude/affectionate-davinci-x0dfgp`, e a ordem é um PR por passo. Enquanto o PR do Passo 1 estiver aberto nesse branch, o Passo 2 não tem para onde ir. Posso usar um branch por passo, no padrão `claude-b/e744-passo-N` (como foi o `claude-b/e899-fable`)? Enquanto não houver resposta, o Passo 2 fica pronto num branch local e sobe assim que o Passo 1 for mesclado ou a permissão chegar.
9. **Tempo do portão com specs de varredura.** O `lab-critico` roda inteiro todo spec alterado, com 25 min para o passo. O Passo 2 altera 17 varreduras de uma vez. Se o portão estourar por tempo, a leitura conservadora é dividir o Passo 2 em dois PRs (não mexo no teto do portão sem resposta).
10. **Rodar o `laboratorio.yml` no branch de um PR.** A tabela por fatia e o erro completo no log (Passo 1) só aparecem numa rodada com esse código, e o workflow não roda em PR. Um disparo manual no branch do PR provaria as duas coisas antes do merge, mas grava em `lab_execucoes` uma linha com `gatilho = workflow_dispatch` e o commit do branch, e o detector de regressão conta essa linha como histórico da main. Leitura conservadora: **não disparo em branch de PR**; a prova fica para a primeira rodada depois do merge.
11. **Ação do servidor redirecionada pelo proxy (E798).** Ver a observação de produto em 7.2. É item para registrar ou fica como está?

## 9. Como refazer as leituras

- Rodadas: API do GitHub Actions, workflow `laboratorio.yml` (runs e jobs com passos).
- Números: `select … from public.lab_execucoes where gatilho = 'schedule' and listados is not null order by criada_em desc` (colunas `passou`, `falhou`, `pulou`, `instavel`, `listados`, `executados`, `nao_executados`, `regressoes`, `por_spec`, `falhas`, `commit_sha`, `run_url`). Só leitura.
- Mapa teste → fatia: no commit da rodada, `LAB_PESADOS=fora npx playwright test --list --shard=N/16 --reporter=json` (fatias 1–16) e `npx playwright test t48-varredura --list --grep "<grupo>"` (17–20).
- Laboratório local (para reproduzir um spec): `dockerd`; `npx --yes supabase@2.120.0 start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit,realtime`; `psql "$LAB_DB_URL" -f supabase/lab/alinhar-producao.sql`; `node scripts/lab/seed-lab.mjs`; `NODE_OPTIONS=--max-old-space-size=8192 npm run build`; os três serviços falsos (`scripts/lab/resend-falso.mjs 3999`, `linkedin-falso.mjs 3997`, `rotas-falso.mjs 3998`); `npx next start -p 3123`; Playwright com `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium --project=chromium --trace off`.

## 10. Diário

- **15/11, 01:15–01:25 UTC.** Leitura do estado (seções 1 a 5). Nada alterado.
- **15/11, 01:40 UTC.** Decisões do Gerente recebidas (relatório em arquivo; seguir com o que não depende de resposta; visual só com julgamento um a um; fila depois do E744). Este arquivo criado sobre a main `c950ec82`.
- **15/11, 01:44 UTC.** Decisões A e B do Gerente recebidas. Rodada manual disparada (run 43664453319, main `c950ec82`). Ordem dos passos confirmada com as duas emendas (seção 6). Começa o Passo 1.
- **15/11.** Passo 1 feito e empurrado (PR draft). Laboratório local de pé na main `c950ec82`. Passo 2 investigado e corrigido num branch local (`e744-passo2-rotas-da-conta`), rodando as 17 varreduras no laboratório local.
- **15/11, 02:48 UTC.** Rodada manual concluída (seção 2.1): 96 specs vermelhos, 5 de 20 fatias verdes. CI do PR #3832 verde na primeira rodada.
- **15/11, 03:27 UTC.** Passo 2 verificado no local (315 verdes sem nova tentativa) e confirmado num branch local, sem push (Dúvida 8).
- **15/11, 12:22 UTC.** Sessão retomada depois de um reinício do ambiente (o laboratório local caiu junto; foi refeito com banco novo). Main sem mudança (`c950ec82`). Passo 3 em curso; "erro completo no log da fatia" acrescentado ao Passo 1.
- **15/11, 14:15 UTC.** Rodada local da triagem concluída (seção 7.3): 66 specs reproduzem com o mesmo erro do CI. CI do PR #3832 verde também no commit `b2c430af`.
- **15/11, 14:20 UTC.** ORDEM-DUET-041 recebida: a triagem vira a tabela única das 96 specs; correção só do que é da minha área. Main em `403858f7` (#3833); branch do PR atualizado sobre ela.
- **15/11, 15:15 UTC.** Tabela das 96 specs completa em primeira passada (`docs/e744-classificacao-96-specs.md`). ORDEM-DUET-046 recebida (pacote de evidência com SHA; conferir a ordem contra a main; sem troca de sessão no meio do Prompt A).
- **15/11, 15:35 UTC.** Rodadas isoladas concluídas (17 specs, 3 vezes cada, main `403858f7`): t14, t534, t590, t683 e t840 falham sempre sozinhas e saíram de "instável"; o t389 entrou no defeito do autosave do assistente; só o t204 varia. Tabela e descrição do PR #3832 atualizadas.

# E775 — desenho da fila de merge: duas alternativas para decisão (09/11/2026)

**Status: DESENHO para validação do coordenador. Nada foi implementado por este documento.**
Fato de partida (verificado em 08/11): a fila de merge nativa do GitHub **não existe em repositório de conta pessoal**; este é de conta pessoal. O que já existe no #3597 (draft) é só o *gate de leitura* `scripts/gate/pode-mesclar.mjs`, que diz PODE/NÃO PODE e nunca mescla.

## Por que existe (o problema)
O CI de um PR testa o PR contra a main **de quando ele foi aberto ou atualizado**. Dois PRs verdes podem quebrar a main juntos. Aconteceu: #3505 (E727/E728) × E731/E651 deixou a main vermelha em `344e3a2` (corrigida só pelo #3598, ainda sem merge). Regra que o desenho tem de garantir: **quem pousa na main já foi testado COM a ponta atual da main dentro.**

## Regras do coordenador que valem para as duas alternativas
1. **Cadeia de merges e merges automáticos NUNCA ao mesmo tempo.** Quando uma cadeia (PRs empilhados: #3597 sobre #3588; #3596 sobre #3579) está sendo mesclada à mão, a automação não mescla nada, e vice-versa.
2. **Main vermelha pausa os merges.** Nenhum PR entra enquanto o último run da main (verify) estiver vermelho, salvo o PR que a conserta.
3. **Merge continua sendo a aprovação** (AGENTS.md: o merge do Daniel é a aprovação de migrações). Em qualquer alternativa, o gesto humano é colocar o PR na fila (ou rotulá-lo); a automação nunca decide sozinha o que entra.
4. PR em rascunho, com conflito (`dirty`) ou sem `verify`+`lab-critico` verdes nunca entra.

---

## Alternativa (a) — migrar para uma organização gratuita e usar a fila nativa

**Como funciona.** Criar uma organização gratuita, transferir o repositório (Settings → Transfer), e criar um ruleset na `main` com *Require merge queue*. Quem aprova clica em "Merge when ready"; o GitHub cria uma branch temporária com a **main + os PRs da frente na fila + este PR**, roda o CI nela (`merge_group`) e só então mescla, um grupo por vez. Os workflows já têm o gatilho `merge_group:` e o nome estável `suite-completa`, então nada nos workflows precisa mudar.
*Nota a confirmar na criação da organização:* pela documentação do GitHub, a fila nativa é oferecida a repositórios **públicos de organização** (este é público); a confirmação final é feita ao criar o ruleset.

**O que muda na rotina.**
- O botão passa a ser "adicionar à fila" em vez de "mesclar"; o CI roda de novo na combinação.
- A regra 1 (cadeia × automático): a fila nativa serializa sozinha, mas **PRs empilhados** (base ≠ main) não entram na fila; a cadeia continua sendo feita à mão, de baixo para cima, e enquanto houver item da cadeia na fila ninguém clica nos outros.
- A regra 2 (main vermelha) a fila nativa **não impõe sozinha**: acrescentar o check `verify` da main como obrigatório do ruleset e, na rotina, olhar a main antes de enfileirar.

**Riscos (o que a migração mexe).**
- **Vercel:** a integração Git do projeto está ligada ao repositório pelo dono atual; após a transferência é preciso reinstalar/reautorizar o app da Vercel na organização e conferir que os deploys de preview e de produção seguem (hoje há um check "Vercel Preview Comments" em todo PR).
- **Actions e segredos:** o workflow "Aplicar migrações em produção" (merge na main aplica o que não está registrado) usa segredos do repositório; confirmar após a transferência que os segredos e os ambientes continuam, **antes** do primeiro merge com migração. Risco alto se falhar silenciosamente.
- **Apps e conectores:** o GitHub App do Claude e quaisquer outros apps precisam ser reinstalados na organização; o escopo de acesso das sessões de agentes (repositório atual) muda de nome/dono.
- **URLs e referências:** o GitHub redireciona o endereço antigo, mas links com `danielrodovalho228-ship-it/...` em docs, scripts e no CLAUDE.md/AGENTS.md precisam ser revisados; o nome "Viva-Nomads-Oficial" fica sob outro dono.
- **Momento:** hoje há **~20 PRs abertos** (vários empilhados) e a main está vermelha. Transferir no meio disso arrisca PRs com base errada e CI que não dispara.
- **Controle:** a organização exige definir quem é dono e membros; o Daniel precisa ser *owner*. Custo: US$ 0 no plano gratuito para repositório público.

**Vantagens.** É o mecanismo que o GitHub mantém; serializa e retesta sem código nosso; menor manutenção. Resolve de vez o "branch atrasado" sem script.

---

## Alternativa (b) — fila própria (automação que mescla um PR por vez)

**Como funciona.** Um workflow `fila-de-merge` (e o script `scripts/gate/` que já existe no #3597) mescla **um PR por vez**, em ciclos:
1. **Entrada:** o PR recebe o rótulo `na-fila` (gesto humano = aprovação; só o Daniel/coordenação rotulam). Ordem: por horário do rótulo.
2. **Trava global:** a automação só começa se (i) a main está verde (último run do `verify` na main = success), (ii) não há rótulo `cadeia-em-andamento` em nenhum PR/issue (regra 1) e (iii) nenhum outro ciclo está rodando (`concurrency: group: fila-de-merge`).
3. **Atualizar e retestar:** se o PR está atrás da main, a automação atualiza a branch **com a ponta da main** (merge, sem reescrever histórico) e **espera o CI do novo head** (`verify` + `lab-critico`, hoje ~5 + ~8 min em paralelo).
4. **Gate:** roda o `pode-mesclar` (PR aberto, não rascunho, base main, `behind_by = 0`, checks verdes **no head**). Só com PODE, mescla (merge commit, como hoje).
5. **Espera a main:** depois de cada merge, espera o run da main (`verify`) terminar. **Verde:** próximo PR. **Vermelho:** pausa a fila, remove o rótulo do próximo, abre aviso e não mescla mais nada (regra 2).
6. **Saída:** PR com conflito (`dirty`), rascunho ou check vermelho sai da fila com comentário; quem resolve é a pista dona (nunca o Daniel).

**O que muda na rotina.** Em vez de clicar "Merge" PR a PR, o humano rotula e acompanha. A cadeia continua à mão: quem a faz põe `cadeia-em-andamento` (a automação para) e tira o rótulo ao terminar. Dois PRs empilhados nunca são rotulados juntos.

**Riscos.**
- **Token:** merge feito com o `GITHUB_TOKEN` padrão **não dispara outros workflows** (a regra do GitHub contra laços). Isso significaria que o merge automático **não dispara o laboratório da main nem a Action de migrações**. Precisa de um **GitHub App** ou PAT de uso restrito (contents/pull-requests write) criado pelo Daniel: é decisão e ação de admin (guardar o segredo no repositório). Sem isso a alternativa (b) não é segura para PR com migração.
- **Permissão:** o merge programático depende de a proteção da `main` permitir o ator; hoje não há proteção ligada (pendência de admin do próprio #3597).
- **Vazão:** é serial; ~12–15 min por PR (atualizar, esperar CI, esperar a main) ≈ 4–5 PRs por hora. Com ~20 PRs na fila de hoje, algumas horas.
- **Janela de corrida:** entre o gate e o merge a main pode andar; a proteção "Require branches to be up to date" do GitHub fecha essa janela e continua sendo necessária.
- **Código nosso:** manutenção de um workflow crítico; um erro nele pode mesclar errado. Mitiga: o gate de leitura já testado, mais teste de guarda do workflow, mais *dry run* (modo "só avisa") nas primeiras execuções.
- **Migrações:** a ordem dos PRs com migração importa (numeração sequencial só pela Pista B); a automação não reordena, só segue a ordem do rótulo.

**Vantagens.** Não mexe em dono, Vercel, apps nem segredos de migração; reversível (apagar o workflow); reaproveita o gate do #3597; dá para ligar já.

---

## Comparação

| Critério | (a) Organização + fila nativa | (b) Fila própria |
|---|---|---|
| Esforço | baixo em código, **alto em migração** (Vercel, apps, segredos) | médio em código; 1 ação de admin (App/token) |
| Risco principal | quebrar deploy/migrações na transferência | merge automático não disparar a Action de migrações (sem token certo) |
| Reversível | difícil (transferir de volta) | sim, apagar o workflow |
| Retesta a combinação | sim, nativo | sim, por atualização + CI + gate |
| Regra "cadeia × automático" | manual (PR empilhado não entra na fila) | imposta pela trava `cadeia-em-andamento` |
| Regra "main vermelha pausa" | acrescentar check obrigatório + disciplina | imposta pela automação |
| Vazão | boa (agrupa) | serial, ~4–5 PRs/h |
| Tempo até valer | depende de janela de migração | dias, em modo "só avisa" primeiro |

## Recomendação
**(b) agora, com (a) como decisão posterior e separada.** Razões: (1) a main está vermelha e há ~20 PRs abertos, o pior momento para transferir o repositório; (2) (b) não toca em Vercel, apps nem segredos da Action de migrações, e é reversível; (3) o gate de leitura já está pronto e testado. Condição para (b) ser segura: **o Daniel cria o GitHub App/token restrito** (sem ele o merge automático não dispara a Action de migrações) e liga a proteção da `main` ("exigir PR", checks `verify`+`lab-critico`, "up to date"). Reavaliar (a) quando a fila esvaziar e houver janela para validar Vercel e migrações com calma; se (a) for adotada, a (b) é descartada sem perda (o gate vira só conferência).

## Decisões que ficam com o coordenador/Daniel
1. Escolha (a) ou (b).
2. Para (b): criar o GitHub App/token restrito e guardá-lo como segredo; quem pode rotular `na-fila`.
3. Ligar a proteção da `main` (hoje não está ligada) e acrescentar `suite-completa` aos obrigatórios só depois da política do E744.
4. Política da main vermelha: pausar *todos* os merges (recomendado) ou só os que não consertam a main.

## Fora deste documento
Implementação, workflow da fila e qualquer mudança de proteção/ruleset. O gate de leitura do #3597 continua como está.


---

## Conferência contra o estado atual (09/11, ~12h UTC) — o que muda no desenho
Conferido: main `344e3a2` (vermelha só pelo drift do E727/E728; o #3598 que a conserta ainda **não** foi mesclado), `.github/workflows/gate-pode-mesclar.yml` e `scripts/gate/` **ainda não estão na main** (#3597 aberto, empilhado sobre o #3588), nenhuma proteção de branch ligada.

O desenho **continua válido**. Ajustes e fatos novos:
1. **Escala da fila:** não são ~20 PRs. O repositório tem cerca de **1.000 PRs abertos** e **111 só da Pista B** (`docs/e779-triagem-prs-pista-b.md`). Com ~4–5 PRs por hora na fila serial da alternativa (b), a fila não esvazia em horas. A fila (qualquer alternativa) precisa de **triagem antes**: só entram PRs prontos e não duplicados.
2. **Conflitos viram regra de saída da fila:** 104 pares de PRs da Pista B conflitam entre si (mesmo arquivo de ação ou fim de `docs/e293-auditoria-retencao.md`). Depois de cada merge, os vizinhos ficam "sujos". A fila deve sair do PR com conflito com comentário, **sem tentar resolver sozinha**, e a pista dona resolve (como já dizia o desenho). A atualização automática da branch só serve para quem está limpo.
3. **Checks exigidos:** além de `verify` e `lab-critico` (obrigatórios), há `e2e` e, em PRs que mexem no workflow, `gerar linhas de base` e `ensaio`. Mantenho só `verify` + `lab-critico` como obrigatórios; os outros não bloqueiam.
4. **O `lab-critico` roda inteiros os specs que o PR altera** (aprendido no #3588): um PR que altere o `t48-varredura` (cadeia de ~100 min) estoura o job de 40 min. Isso torna PRs que tocam specs pesados **inadmissíveis na fila** sem tratar o portão antes. Entra como regra de saída da fila.
5. **Main vermelha pausa:** hoje ela está vermelha, então pela regra 2 **nenhum merge entraria**, exceto o #3598. Na prática o primeiro item da fila é o #3598.
6. **Recomendação:** mantida: (b) agora, com a condição do App/token restrito. Soma-se a condição de **triagem prévia** (ponto 1).

# E722 — pré-aceitação de 72 horas

Fechado pelo coordenador com a decisão do Daniel. **Tudo atrás de `PRE_ACEITACAO_72H_ATIVA` (desligada).** Migração 0334 (só colunas novas em `propostas`).

## Regras (puras em `src/lib/propostas/pre-aceitacao.ts`)
- **72 horas corridas** a partir do aceite da proposta; a **data e a hora exatas** (horário de Brasília) aparecem na tela da proposta.
- **Teto pela entrada:** se a data de entrada vier antes das 72 h, o prazo é o início do dia de entrada.
- **Lembretes 24 h e 6 h antes** do fim, respeitando o silêncio das 22h às 7h (regra única de `silencio.ts`): no silêncio sai às 7h; se as 7h passarem do fim, sai às 21h59 anterior; janela curta demais não ganha o lembrete que cairia antes do início.
- **Regra de corrida:** vários pré-aceites nas mesmas datas, o primeiro a concluir o contrato fica; os demais recebem mensagem clara, sem penalidade (`pre_aceitacao_perdeu_em`). **Nada volta sozinho à fila:** o lead não é mexido e só o dono reabre, à mão (e só com as datas livres). Detecção com `conflitoNoImovel`; falha de leitura não conta como perda.
- **Expira sem punição** (status `expirada` + `pre_aceitacao_expirou_em`; nada é cobrado nem anotado) e pode ser **reaberta no máximo 2 vezes** (constraint 0..2 no banco). **A 3ª expiração encerra a candidatura** (`pre_aceitacao_encerrada_em`), com aviso ao morador e ao dono.
- **Relógio do dono (E395):** 1 dia útil (seg–sex, Brasília), mesma hora do próximo dia útil (sexta→segunda; fim de semana conta de segunda 00h), teto = início do dia de entrada, recomeça a cada volta (`pre_aceitacao_dono_ate`). Um prazo por vez: com a candidatura no dono, a tela e o e-mail mostram só o dele.
- **Congelamento (decisão do Daniel):** "Ao reabrir uma candidatura, a taxa congelada na pré-aceitação CONTINUA VALENDO, não recalcula." A reabertura e o cron nunca escrevem `taxa_congelada` (teste de guarda).

## Onde está
- Aceite (`aceitar` em `propostas-actions.ts`): grava `pre_aceitacao_ate` só com a chave ligada.
- Executor: `src/lib/propostas/pre-aceitacao-servidor.ts` (lembretes, expiração, reabertura) + `GET /api/cron/pre-aceitacao` (Bearer `CRON_SECRET`; lab: `?agora=<ISO>`).
- Ação `reabrirPreAceitacao(id)` (qualquer das partes; quem perdeu a corrida, só o dono) + botão "Reabrir por mais 72 horas" na tela da proposta expirada.
- Tela: bloco "Prazo para concluir o contrato" em `/dashboard/propostas/[id]`.

## Dúvidas para a decisão
1. **Agenda do cron:** decidido, de 1 em 1 hora (`0 * * * *` no `vercel.json`). Atenção: cron sub-diário exige plano Vercel que permita; se o deploy recusar, é isso.
2. **"Concluir o contrato"** = a proposta sair de `aceita` (`em_contrato`/`contrato_assinado`); só `aceita` expira. Propostas antigas ficam sem prazo (nada expira retroativamente).
3. **Teto pela entrada** usa o início do dia de entrada (conservador).
4. A regra de corrida aqui é o texto e o prazo; a trava "perde a vez" entre candidatos do mesmo imóvel já vem do conflito de datas do aceite (`conflitoNoImovel`).

Testes: `e722-pre-aceitacao.test.ts` (8) e `e722-ligacoes.test.ts` (5). Sem prova ao vivo.

5. **Nome:** o prazo se chama "pré-aceitação"/"prazo para concluir o contrato"; o termo "validade da proposta" (outro prazo, da proposta enviada) não é usado (teste de guarda).

## Um prazo por vez + contexto (08/11/2026)
- Tela e e-mail mostram UM prazo principal (morador enquanto vigente; dono, 1 dia útil, depois da expiração) e uma linha de contexto sobre o outro (`linhaDeContexto`).
- A 3ª expiração encerra a candidatura com o mesmo texto da 1ª janela (`TEXTO_JANELA_TERMINOU`) + frase de encerramento.
- Datas nunca ficam bloqueadas na janela: só contrato `ativo` ocupa o imóvel (teste de guarda em `e722-ligacoes.test.ts`).

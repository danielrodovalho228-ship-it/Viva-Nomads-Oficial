# E1012 — t30 "Caução simples": a resposta automática do acolhimento não aparecia na tela do chamado

**Sintoma (corridas de 16 e 17/11, 3 instáveis + 1 vermelho em 7):** a resposta da Viva já estava gravada no chamado (o poll no banco passa), mas a página do chamado seguia em "Recebemos. Uma pessoa da equipe responde em até 24 h." e o texto "Resposta automática da Viva…" não aparecia em 15 s.

## Causa (lab, 18/11) — produto

A Caução é categoria **sensível**: o chamado fica com a equipe (`quemAtende` → `equipe_com_acolhimento`) e a Viva manda só o acolhimento automático, no servidor, **depois** da resposta (`after(() => responderNaEquipe(...))`). A tela do chamado (`src/components/ajuda/central-ajuda.tsx`) só voltava a conferir as mensagens quando o chamado estava **com a Viva** (`responsavel_tipo === "ia"`). Se a página carregava antes do acolhimento ficar pronto (servidor carregado), o morador nunca via a resposta automática sem recarregar.

## Correção

`esperaResposta()` (`src/lib/atendimento/acolhimento.ts`): a tela confere de novo a cada 2,5 s, até 24 vezes, enquanto a última mensagem é da pessoa ou do sistema e o chamado está em aberto — com a Viva **e** com a equipe. O aviso "A Viva está escrevendo…" continua só quando é a Viva que atende. No chamado com a equipe sem acolhimento (emergência), são no máximo 24 leituras em 1 minuto.

## Provas

- Unidade, `src/lib/atendimento/acolhimento.test.ts`: 2 testes novos `E1012 esperaResposta…`, vermelhos sem a função (fail 2), verdes com ela (pass 10, fail 0).
- E2E sem a correção (laboratório com a main de 18/11), `t30 -g "Caução simples" --repeat-each=6 --workers=3`: **1 failed, 5 passed** — `t30:68 locator('body') toContainText(RODAPE)`, o mesmo erro do CI.
- E2E com a correção: ver a descrição do PR.

Nenhuma asserção do teste mudou.

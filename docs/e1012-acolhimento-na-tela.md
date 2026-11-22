# E1012 — t30 "Caução simples": a resposta automática do acolhimento não aparecia na tela do chamado

**Sintoma (corridas de 16 e 17/11, 3 instáveis + 1 vermelho em 7):** a resposta da Viva já estava gravada no chamado (o poll no banco passa), mas a página do chamado seguia em "Recebemos. Uma pessoa da equipe responde em até 24 h." e o texto "Resposta automática da Viva…" não aparecia em 15 s.

## Causa (lab, 18/11) — produto

A Caução é categoria **sensível**: o chamado fica com a equipe (`quemAtende` → `equipe_com_acolhimento`) e a Viva manda só o acolhimento automático, no servidor, **depois** da resposta (`after(() => responderNaEquipe(...))`). A tela do chamado (`src/components/ajuda/central-ajuda.tsx`) só voltava a conferir as mensagens quando o chamado estava **com a Viva** (`responsavel_tipo === "ia"`). Se a página carregava antes do acolhimento ficar pronto (servidor carregado), o morador nunca via a resposta automática sem recarregar.

## Correção

`esperaResposta()` (`src/lib/atendimento/acolhimento.ts`): a tela confere de novo a cada 2,5 s, até 24 vezes, enquanto a pessoa ainda espera a resposta da última mensagem dela — com a Viva, até a primeira resposta da Viva (como já era); com a equipe, até a resposta da equipe ou a **resposta automática com o rodapé**. O acolhimento da equipe vem em duas mensagens da Viva (o aviso "a Viva já respondeu logo abaixo" e, segundos depois, a resposta com o rodapé): a primeira versão da correção parava no aviso e a resposta voltava a não aparecer (lab: 1 em 12). O aviso "A Viva está escrevendo…" continua só quando é a Viva que atende. No chamado com a equipe sem resposta automática (emergência), são no máximo 24 leituras em 1 minuto.

## Provas

- Unidade, `src/lib/atendimento/acolhimento.test.ts`: 3 testes novos `E1012 esperaResposta…`, vermelhos sem a função, verdes com ela (pass 11, fail 0).
- E2E sem a correção (laboratório com a main de 18/11), `t30 -g "Caução simples" --repeat-each=6 --workers=3`: **1 failed, 5 passed** — `t30:68 locator('body') toContainText(RODAPE)`, o mesmo erro do CI.
- E2E com a correção (laboratório recompilado com c4cc9d928): `-g "Caução simples" --repeat-each=10 --workers=3` → **10 passed**; t30 inteiro → **2 passed**.
- Cuidado para repetir no lab: todas as repetições usam a mesma conta de inquilino e esgotam o limite de mensagens por pessoa (`limites_uso` `chamado-msg:<usuário>`, que o `beforeAll` do t30 não apaga — ele apaga só `chamado:%`). Zerar `chamado%` entre rodadas.

Nenhuma asserção do teste mudou.

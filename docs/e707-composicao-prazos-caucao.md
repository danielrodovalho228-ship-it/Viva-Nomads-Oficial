# E707 — composição dos prazos da caução

Tudo atrás de `CAUCAO_PRAZOS_ATIVA` (desligada) até o parecer da Dra. Beatriz. Sem migração.

**(a) Devolução devida de imediato; 30 dias só como teto externo.** Parecer sem desconto ou silêncio no 7º dia = liberação integral = devolução **devida desde** o dia do parecer (ou o dia seguinte ao prazo de 7 dias). Os 30 dias passam a ser só o **teto externo** contado do check-out confirmado (pendência e bloqueio de anúncio novo só depois dele). Marco único: `tetoExternoDevolucao` em `lib/caucao.ts`, usado por `lib/caucao/prazos.ts` (`PRAZO_DEVOLUCAO_DIAS = PRAZO_REEMBOLSO_DIAS`). O aviso do cron diz "a devolução é devida agora" e informa o teto externo.

**(c) Parte indiscutível.** `parteIndiscutivel(caução, descontos)` = caução − tudo o que o dono pleiteia (aceito, proposto ou contestado). Ao fim da janela de contestação (5 dias), o estado `em_disputa` traz `liberarParteIndiscutivel { valor, desde }` — a Viva só informa o valor; nunca decide a disputa nem move dinheiro.

## Dúvidas (leitura conservadora aplicada)
1. "Check-out confirmado" = hoje o último dia do último bloco (`caucao_prazos.saida_em`). Se for outro marco (ex.: conferência de saída assinada), troca-se num ponto só.
2. A página `/dashboard/reembolsos` (simulador) ainda conta 30 dias a partir do clique; não mexi porque está fora da chave. Quando a chave ligar, ela deve usar `tetoExternoDevolucao`.
3. (c) só calcula e expõe o valor; aviso aos dois e registro no livro aguardam o parecer. Sem pendência/bloqueio novo para disputa.

Testes: `src/lib/caucao/e707-composicao-prazos.test.ts`. Sem prova ao vivo.

## Simulador /dashboard/reembolsos (resíduo)
Contava 30 dias a partir do CLIQUE. Agora `prazoLimiteDoReembolso` (`lib/caucao.ts`): com `CAUCAO_PRAZOS_ATIVA` **desligada**, igual a antes (30 dias a partir de hoje, mesmo texto); **ligada**, a tela pede a "Data do check-out", o prazo é o teto externo contado dali (`tetoExternoDevolucao`, marco único), sem check-out informado não mostra prazo, e o texto diz que a devolução é devida de imediato nos casos sem desconto. Teste: `src/lib/caucao/e707-simulador-reembolso.test.ts`.


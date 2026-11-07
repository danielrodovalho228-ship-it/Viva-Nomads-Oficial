# E663 — Jornada de mensagens da estadia

Frente aprovada pelo Daniel (07/11/2026). Sem migração: usa o motor das automações (`automacoes_envios`, chave por aviso+pessoa+variante).

## Momentos
| Momento | Quando | Quem | Observação |
|---|---|---|---|
| Confirmação (`jornada_confirmacao`) | hoje ou ontem após a assinatura das duas partes | morador | Pede os documentos **pela plataforma**; sem dado pessoal, foto nem contato no e-mail (E441). Contrato antigo não recebe. |
| D-7 instruções liberadas | já existia (`estadia_instrucoes_liberadas`) | morador | **Reaproveitado**, não tocado. |
| Chegada (`jornada_chegada`) | dia da entrada | morador e dono | Só com o 1º pagamento confirmado (mesma condição do D-7). |
| Semana da saída (`jornada_semana_saida`) | 7 dias antes da saída | morador e dono | Só com o 1º pagamento; não sai se cairia na chegada ou antes. |
| Meio da estadia (`jornada_meio_estadia`) | metade da estadia, só estadia de 60+ dias | morador | "Tudo certo? Algo quebrou?" + avaliação parcial. |

## Remarcação por aditivo (E652)
As datas saem dos blocos ATUAIS do contrato a cada rodada do cron; a data de que o momento depende entra na chave de envio:
chegada ← entrada; semana da saída ← saída; meio ← entrada e saída. Remarcou: a data antiga deixa de disparar, a chave nova ainda não foi enviada, e o aviso sai nas datas novas. Prorrogou só a saída: a chegada não repete, a semana da saída sim. Coberto em `jornada-mensagens.test.ts`.

## Código
- Puro: `src/lib/estadia/jornada-mensagens.ts` (+ teste).
- Cron: bloco 8 de `src/app/api/cron/automacoes/route.ts` (respeita `AUTOMACOES_ATIVO`, modo simulado, silêncio e "parar de receber" pelo laço comum; a chave `AUTOMACOES_ATIVO` não foi tocada).
- Eventos novos: `eventos-email.ts`, `matriz-notificacoes.ts` (categoria "lembretes", sem push), `imagens-email.ts`, `regras.ts`.

## Testes
Módulos inteiros rodados: `src/lib/estadia`, `src/lib/automacoes`, `src/lib/notifications`, `src/config`, `src/lib/data`, `tests/laboratorio`, `tests/migracoes` — verdes; `tsc` limpo. Sem prova ao vivo.

## Dúvidas
1. Janela da confirmação: hoje ou ontem após a assinatura (contrato mais antigo não recebe). Ajustável em `CONFIRMACAO_JANELA_DIAS`.
2. Estadia longa = 60 dias ou mais (`MEIO_ESTADIA_MIN_DIAS`).
3. Print: e-mails dependem do cron e do ambiente de envio; não feito (sem prova ao vivo).

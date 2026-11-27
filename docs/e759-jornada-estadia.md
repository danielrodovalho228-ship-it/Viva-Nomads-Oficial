# E759 — jornada de mensagens da estadia (confirmação, D-7, chegada, meio)

Prova logada do E663 (08/11, pós-cron 13:00 UTC): 1 de 4 momentos. Diagnóstico por ponto:

1. **Confirmação não chegou à Fernanda.** A regra só valia até 1 dia depois da assinatura; as estadias-semente (0327) foram assinadas há 5–35 dias. Corrigido: a confirmação também sai quando a estadia está CONFIRMADA (assinada pelas duas partes + 1º pagamento confirmado) e ainda não começou. Chave fixa: uma vez só por morador.
2. **D-7 não era evento.** Só existia o e-mail de instruções (`estadia_instrucoes_liberadas`). Novo evento `jornada_d7` (morador, 7 dias antes da entrada, com 1º pagamento), registrado na matriz, nos textos e nas imagens de e-mail. Remarcar reenvia na data nova (a data entra na chave).
3. **Meio não disparou.** A 0327 gravou o bloco do meio com 59 dias (< 60); a 0328 corrigiu o dado para 60. Regra do meio (60+ dias) mantida; sem mudança de código.
4. **Chegada em 08/11 × página em 09/11** e 5. **saída 14/11 × 16/11**: não há duas contas. Cron, e-mails e página leem o mesmo dado (primeira entrada e última saída dos blocos válidos). O dado mudou entre o envio e a leitura: a 0327 (ALVO 08/11, saída = ALVO+6 = 14/11) foi reposicionada pela 0328 depois das 09:30 de Brasília (ALVO 09/11, saída = ALVO+7 = 16/11). Para tornar isso à prova de divergência futura, as datas de toda mensagem passam por uma função só: `datasDaEstadia` (`src/lib/contrato-blocos.ts`), usada pelo cron da jornada, pelos avisos de automação e pelos e-mails da estadia.

Specs: `src/lib/estadia/e759-jornada-quatro-momentos.test.ts` (confirmação, D-7, meio, chegada com datas fixas; fonte única; registro do evento). A reprova com massa nova na janela fica com o chat principal. Sem migração, sem prova ao vivo.

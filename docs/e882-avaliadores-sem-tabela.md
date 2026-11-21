# E882 — /parceiros/avaliadores não cita "tabela da Viva"

**Defeito:** o bloco "Como é pago" dizia "a tabela da Viva para a cidade e o porte do imóvel é só uma referência", mas não há tabela pública em nenhuma superfície (a `vistoria_precos` é interna e o próprio comentário da página diz "Sem valor da tabela").

**Correção:** a frase sai para `FRASE_REFERENCIA_AVALIADOR` em `src/lib/vistoria/regras.ts`:
"Você define o seu valor e o seu prazo em cada pedido; o valor de referência que aparece em cada pedido, pela cidade e pelo porte do imóvel, é só uma referência." (é o "referência R$ …" que `/dashboard/parceiro/avaliacao` mostra em cada pedido).

**Teste:** `src/lib/parceiros/e882-avaliadores-sem-tabela.test.ts` (vermelho na main, verde na branch). O `e686` passa a conferir a constante em vez do texto literal.

# Achado 158 — Instruções de entrada (check-in): leitura que falha virava "sem acesso" / "não preenchidas"

Fluxo: dono e morador › contrato › instruções de entrada. `contexto` (checkin-actions) ignorava o `error` das leituras de `contratos` e
`contratos_checkin`: a falha virava null ("sem acesso") ou "instruções ainda não preenchidas" — o dono achava que devia preencher de novo e o
morador, que nada fora enviado. Agora as duas leituras lançam (a página mostra "Tentar de novo"); `salvarInstrucoesEntrada` devolve a
mensagem "Não foi possível ler as instruções de entrada agora. Tente de novo." em vez de estourar.
Teste: `src/lib/data/achado158-checkin-leitura.test.ts` (visto vermelho antes). Escopo `src/lib/data`: ver PR; `tsc` limpo.

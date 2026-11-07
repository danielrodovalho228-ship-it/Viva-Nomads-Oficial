# Registro de medição da Pista QA

Uma linha por item provado. Alimenta a medição do Daniel: o tempo entre o merge e o veredito, e quanto se perde por falta de massa.

- **Merge:** horário do merge na `main`, conferido no GitHub (UTC).
- **Veredito:** horário em que a Pista QA fechou a proposta de veredito (UTC). O fechamento do item é do Muse do chat principal.
- **Ambiente:** `produção/navegador` é o site no ar, aberto num Chromium de verdade, sem login. `produção/logado` é o mesmo pela porta de QA. `lab` é o laboratório (Actions ou local).

| Item | PR | Merge (UTC) | Veredito (UTC) | Resultado | Faltou massa? | Ambiente | Detalhe |
|---|---|---|---|---|---|---|---|
| E695 | #3276 | 2026-11-07 19:48 | 2026-11-07 21:36 | provado | não | produção/navegador (390 e 1280) | [rodada 07/11](qa-rodadas/2026-11-07.md#e695) |
| E696 | #3280 | 2026-11-07 19:48 | 2026-11-07 21:36 | provado | não | produção/navegador (390 e 1280) | [rodada 07/11](qa-rodadas/2026-11-07.md#e696) |
| E702 | #3280 | 2026-11-07 19:48 | 2026-11-07 21:36 | parcial | sim: nenhum imóvel no ar com data calculada diferente da cadastrada | produção/navegador (390 e 1280) | [rodada 07/11](qa-rodadas/2026-11-07.md#e702) |
| E694 | #3275 | 2026-11-07 19:48 | 2026-11-07 21:36 | parcial: o essencial passa, com resíduo D1 e D2 | não | produção/navegador (390 e 1280), visitante sem login | [rodada 07/11](qa-rodadas/2026-11-07.md#e694) |

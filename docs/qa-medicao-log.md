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
| E697 | #3299 | 2026-11-07 22:38 | 2026-11-07 23:00 | provado | não | produção/navegador (1280 e 390): 15 exemplos, SHA-256 das fotos | [rodada 22:40](qa-rodadas/2026-11-07-2240.md) |
| E698 | #3312 | 2026-11-07 22:37 | 2026-11-07 23:00 | parcial: fotos e aviso do mapa passam; retângulo vazio nos 1–2 s antes de o mapa montar; avatar (logado) não provado | não | produção/navegador (1280 e 390), tiles do mapa simulados | [rodada 22:40](qa-rodadas/2026-11-07-2240.md) |
| E681 | #3245 | 2026-11-07 19:50 | 2026-11-07 23:00 | parcial: lab verde (t1427); falta a prova ao vivo logada | não (lab) | lab #2722 (`b0ab598`) | [rodada 22:40](qa-rodadas/2026-11-07-2240.md) |
| E674 | #3247, #3263 | 2026-11-07 19:50 | 2026-11-07 23:00 | parcial: lab verde (t1399, t1430); falta a prova ao vivo logada | não (lab) | lab #2722 | [rodada 22:40](qa-rodadas/2026-11-07-2240.md) |
| E703 | #3287 | 2026-11-07 19:49 | 2026-11-07 23:00 | parcial: lab verde (t1438); falta a prova ao vivo logada | não (lab) | lab #2722 | [rodada 22:40](qa-rodadas/2026-11-07-2240.md) |
| E679 (formulário) | #3231 | 2026-11-07 18:44 | 2026-11-07 23:00 | parcial: t1432 verde, **mas t182 passo 6 (avaliações às cegas) estourou o tempo** e t28 foi pulada | sim: falta avaliador ativo para a parte da conduta | lab #2722 | [rodada 22:40](qa-rodadas/2026-11-07-2240.md) |
| E704 | #3291 | 2026-11-07 22:38 | 2026-11-07 23:05 | reprovado em produção: a correção é só do motor Mapbox; o ar roda Leaflet + CARTO | não | produção/navegador (1280), motor do mapa conferido no DOM e na rede | [sequência 23:02](qa-rodadas/2026-11-07-2305.md) |

# Erros/estados vazios — rodada 15 (lista de candidaturas do morador)
Mesmo padrão das rodadas 9–14. `getMinhasCandidaturas` (leads-actions) já lançava quando a leitura principal falhava e o chamador exigia; duas leituras auxiliares ignoravam o erro:
- mensagens do dono ao morador: falha virava "ninguém falou comigo", e a candidatura aparecia como "enviada" em vez de "em análise";
- contratos do morador: falha virava "sem contrato", e o selo do contrato sumia da candidatura.
Agora as duas lançam `MSG_CANDIDATURAS_NAO_CARREGARAM` quando o chamador exige (mesma regra da leitura principal).
Teste: `src/lib/data/e293-leituras-candidaturas.test.ts`. Sem migração, sem prova ao vivo. `AUTOMACOES_ATIVO` intocado.

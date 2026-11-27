# E689 — divergência da estadia de saída (VN-CT-A0327C00): causa e correção (migração 0328)

**Achado da QA (noite de 07/11):** a estadia de saída aparecia com "saída em 14/11" e "conferência de saída até 16/11", diferente do desenho (saída em ALVO+7 = 15/11).

**Conferido em produção (só leitura):** contrato `a0327c00-…-11`, período `[2026-10-16, 2026-11-15)`, bloco `2026-10-16 → 2026-11-14`, criado em 08/11 01:36 (Brasília), antes das 09:30, portanto ALVO = 08/11. O período estava como desenhado; o **bloco** terminava um dia antes.

**Causa:** o app lê o último dia do último bloco (`contrato_blocos.fim`, inclusivo) como a saída (jornada E663, lembrete de saída, pedido de avaliação). A 0327 usou o fim do `daterange` (exclusivo) como a saída e deixou o bloco em ALVO+6. Efeitos:
- **saída:** a "semana da saída" (fim − 7) caía em ALVO−1, um dia antes da rodada do cron, e não disparava; "saída em 14/11" e "conferência até 16/11" são o dia certo para um bloco que termina em 14/11;
- **meio:** o bloco tinha 59 dias (a regra pede 60 ou mais), então a mensagem do meio da estadia nem existia. O teste da 0327 conferia o período, não o bloco que o app lê.

**Correção (0328, só dado, só ids fixos `a0327…`, só contrato ativo e dono de conta de teste):** recalcula ALVO como a 0327 e reposiciona os blocos: chegada ALVO a ALVO+29; meio ALVO−30 a ALVO+30 (60 dias; meio = ALVO); saída ALVO−22 a ALVO+7 (semana da saída = ALVO). Realinha o período e a data do 1º pagamento. Rollback em `supabase/producao/rollback/0328_rollback.sql`.

**Prova:** `src/lib/qa/massa-estadia-semente-datas-0328.test.ts` roda a regra real `momentosDeHoje` sobre as datas lidas do SQL (um momento por estadia, no dia ALVO). Sem prova ao vivo.

**Atenção:** as regras do cron são de dia exato. Se a Action aplicar a 0328 depois da rodada do dia ALVO, a jornada daquele dia não sai; a 0328 recalcula ALVO na hora da aplicação (hoje se antes das 09:30 de Brasília, senão amanhã).

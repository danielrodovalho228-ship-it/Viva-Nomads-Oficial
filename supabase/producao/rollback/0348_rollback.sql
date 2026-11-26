-- Viva Nomads — rollback da 0348 (E1072): volta a regra "um pagamento de valor mensal ativo por bloco" e tira a coluna
-- `parte`. Nunca roda sozinho.
-- ATENÇÃO: se já existir algum registro complementar ativo (dois registros de valor mensal no mesmo bloco), a recriação
-- do índice antigo FALHA e a transação inteira é desfeita — nada muda. Nesse caso, primeiro decide-se o que fazer com
-- os complementos; este script não apaga nem anula registro nenhum.
begin;
set local lock_timeout = '5s';
create unique index if not exists pagamentos_bloco_um_valor_mensal
  on public.pagamentos_bloco (bloco_id) where tipo = 'aluguel' and anulado_em is null;
drop index if exists public.pagamentos_bloco_uma_parte_por_bloco;
alter table public.pagamentos_bloco drop constraint if exists pagamentos_bloco_parte_valida;
alter table public.pagamentos_bloco drop column if exists parte;
delete from supabase_migrations.schema_migrations where version = '20261121000348';
commit;

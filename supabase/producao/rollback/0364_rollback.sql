-- Viva Nomads — desfazer a 0364 (E1180: o prazo de entrega do credenciamento no teto de 5 dias). Volta a regra da coluna
-- ao 1 a 30 da 0325. Nenhum dado é alterado: tudo o que cabe em 1 a 5 cabe em 1 a 30.
begin;
alter table public.avaliadores_credenciamento
  drop constraint if exists avaliadores_credenciamento_prazo_entrega_dias_check,
  add constraint avaliadores_credenciamento_prazo_entrega_dias_check
  check (prazo_entrega_dias is null or prazo_entrega_dias between 1 and 30);
delete from supabase_migrations.schema_migrations where version = '20261125000364';
commit;

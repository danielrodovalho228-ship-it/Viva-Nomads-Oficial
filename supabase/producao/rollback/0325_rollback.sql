-- Rollback da 0325 (E682). Remove só as 3 colunas de termos próprios do avaliador.
begin;
alter table public.avaliadores_credenciamento
  drop column if exists preco_proprio, drop column if exists prazo_entrega_dias, drop column if exists prazo_resposta_horas;
delete from supabase_migrations.schema_migrations where version = '20261107000325';
commit;

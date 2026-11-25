-- Viva Nomads — desfazer a 0361 (E1156: prazo do laudo combinado). Apaga a coluna; os pedidos voltam a contar pelo
-- padrão. Rode só junto com a reversão do código que a lê.
begin;
alter table public.vistoria_pedidos drop column if exists prazo_laudo_dias_uteis;
delete from supabase_migrations.schema_migrations where version = '20261124000361';
commit;

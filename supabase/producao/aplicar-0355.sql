-- Viva Nomads — aplicar 0355 (E1099). Idempotente. Aplicada pela Action quando o PR é mesclado.
-- E1099 parte 2 (ORDEM-DUET-458 §2 / 460 §1): o "Sobre" do avaliador credenciado — campo opcional, até 600 caracteres,
-- escrito pelo próprio avaliador. Só acrescenta a coluna; nenhuma função nem dado muda.
-- Rollback: supabase/producao/rollback/0355_rollback.sql
begin;
set local lock_timeout = '5s';

alter table public.avaliadores_credenciamento
  add column if not exists sobre text
  constraint avaliadores_credenciamento_sobre_tamanho check (sobre is null or char_length(sobre) <= 600);

insert into supabase_migrations.schema_migrations (version, name)
select '20261122000355', '0355_sobre_do_avaliador_e1099'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261122000355');
commit;

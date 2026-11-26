-- Viva Nomads — aplicar 0358 (E1113). Idempotente. Aplicada pela Action quando o PR é mesclado.
-- E1113 (ORDEM-DUET-498 §3): o gatilho da 0057 (bloqueia_contato_texto, rigoroso) em profiles.bio, só na edição.
-- Nenhuma função nova; nenhum dado muda.
-- Rollback: supabase/producao/rollback/0358_rollback.sql
begin;
set local lock_timeout = '5s';

drop trigger if exists contato_perfil_bio on public.profiles;
create trigger contato_perfil_bio before update of bio on public.profiles
  for each row execute function public.bloqueia_contato_texto('bio', 'rigoroso');

insert into supabase_migrations.schema_migrations (version, name)
select '20261122000358', '0358_bio_sem_contato_e1113'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261122000358');
commit;

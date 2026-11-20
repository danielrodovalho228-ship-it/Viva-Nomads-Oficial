-- Viva Nomads — aplicar 0318 (E668: papel "parceiro" só vale se escolhido). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0318_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.profiles add column if not exists papel_ativo_escolhido_em timestamptz;

comment on column public.profiles.papel_ativo_escolhido_em is
  'E668: quando a pessoa escolheu o papel ativo (selo/Conta). papel_ativo = parceiro sem este carimbo é valor antigo gravado pela área e não vale.';

grant update (papel_ativo_escolhido_em) on public.profiles to authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000318', '0318_papel_escolhido_e668', array['-- conteúdo em supabase/migrations/0318_papel_escolhido_e668.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000318');

commit;

-- Viva Nomads — aplicar 0105 (avisos do CEO só para o Daniel; alertas operacionais por opção do admin).
-- PRECISA APROVAÇÃO DO DANIEL — não aplicado. Aplicada pela Action quando o PR é mesclado (o merge é a aprovação).
-- Rollback: supabase/producao/rollback/0105_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.profiles add column if not exists recebe_avisos_ceo boolean not null default false;
alter table public.profiles add column if not exists recebe_alertas_operacionais boolean not null default false;

comment on column public.profiles.recebe_avisos_ceo is 'Avisos do Moacir e decisões de CEO (push). Só o dono; não editável pelo usuário.';
comment on column public.profiles.recebe_alertas_operacionais is 'Alertas operacionais (documento na fila, chamado, parceiro). O admin liga na Conta.';

update public.profiles p
   set recebe_avisos_ceo = true, recebe_alertas_operacionais = true
 where p.id = (select id from public.profiles where role = 'admin' order by created_at asc limit 1)
   and not exists (select 1 from public.profiles where recebe_avisos_ceo);

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261011000105', '0105_avisos_ceo_alertas',
       array['-- conteúdo em supabase/migrations/0105_avisos_ceo_alertas.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261011000105');
commit;

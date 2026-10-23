-- Viva Nomads — rollback da 0220 (Sair da Viva — Prompt 51, fase 1). Idempotente.
-- Contas pausadas voltam a ativas (a coluna sai); os motivos, as correções e as denúncias são apagados.
begin;
set local lock_timeout = '5s';
drop table if exists public.denuncias_anuncio;
drop table if exists public.qualidade_correcoes;
drop table if exists public.saidas_motivos;
update public.properties set status = 'active' where pausado_pela_conta and status = 'paused';
update public.parceiros set status = 'publicado' where pausado_pela_conta and status = 'pausado';
alter table public.parceiros drop column if exists pausado_pela_conta;
alter table public.properties drop column if exists pausado_pela_conta;
alter table public.profiles drop column if exists pausada_em;
delete from supabase_migrations.schema_migrations where version = '20261023000220';
commit;

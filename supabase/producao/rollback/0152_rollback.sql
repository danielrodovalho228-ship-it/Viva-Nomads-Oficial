-- Rollback da 0152: tira a trilha da conferência automática, o cache de proximidades, a negociação do anúncio e os
-- limites privados. O status dos documentos (document_status) NÃO muda: aprovados seguem aprovados.
begin;
drop trigger if exists qualificacao_conferencia_servidor on public.qualification_checklists;
drop function if exists public.qualificacao_conferencia_servidor();
drop index if exists public.qualification_conferido_por_idx;
alter table public.qualification_checklists drop constraint if exists qualification_conferido_por_valido;
alter table public.qualification_checklists
  drop column if exists conferencia,
  drop column if exists conferido_por,
  drop column if exists revisao_ate;
drop table if exists public.proximidades_cep;
drop table if exists public.property_negociacao_limites;
alter table public.properties drop constraint if exists properties_internet_mbps_faixa;
alter table public.properties
  drop column if exists negociacao,
  drop column if exists internet_mbps;
delete from supabase_migrations.schema_migrations where version = '20261017000152';
commit;

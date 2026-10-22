-- Viva Nomads — rollback da 0206 (Minimização e eliminação, fase 1, Prompt 58). Idempotente.
-- ATENÇÃO: apaga o livro de eliminações, o relatório simulado, os alertas e os hashes das fotos.
-- Os caminhos continuam aceitando nulo: o arquivo que já saiu não volta, e a linha fica só com o veredito.
begin;
set local lock_timeout = '5s';
drop table if exists public.fotos_anuncio_hash;
drop table if exists public.eliminacoes_alertas;
drop table if exists public.eliminacoes_simulado;
drop table if exists public.eliminacoes_registro;
alter table public.documentos_inquilino drop column if exists arquivo_eliminado_em;
alter table public.qualification_checklists drop column if exists document_eliminado_em;
alter table public.property_ownership_checks drop column if exists arquivo_eliminado_em;
delete from supabase_migrations.schema_migrations where version = '20261022000206';
commit;

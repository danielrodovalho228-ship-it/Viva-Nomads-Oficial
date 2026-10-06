-- Antes da 0073: não há chamados. Alinha o storage mínimo ao de produção.
reset role;
alter table storage.buckets add column if not exists file_size_limit bigint, add column if not exists allowed_mime_types text[];
select v('ANTES@0073','tabela de chamados não existe','select (to_regclass(''public.chamados'') is null)::text','true');

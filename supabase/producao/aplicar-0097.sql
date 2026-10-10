-- Viva Nomads — aplicar 0097 (Central v2, PR A parte 1: bucket privado central-anexos).
-- Aplicada pela Action "Aplicar migrações em produção" quando o PR é mesclado (o merge é a aprovação).
-- Rollback: supabase/producao/rollback/0097_rollback.sql. Só cria coisa nova. Sem DROP.
begin;
set local lock_timeout = '5s';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'central-anexos', 'central-anexos', false, 20971520,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'
  ]
)
on conflict (id) do nothing;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261010000097', '0097_central_anexos',
       array['-- conteúdo em supabase/migrations/0097_central_anexos.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261010000097');
commit;

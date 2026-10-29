-- Viva Nomads — rollback da 0255: recria o bucket privado central-anexos como na 0097 (vazio; a 0097 não tinha política).
-- Idempotente. A linha da 0255 em schema_migrations sai junto, para a Action poder reaplicar.
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
delete from supabase_migrations.schema_migrations where version = '20261029000255';
commit;

-- Viva Nomads — aplicar 0288 (E445 item 5: anexos de foto e PDF no chat). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0288_rollback.sql.
begin;
set local lock_timeout = '5s';

-- 0288 — E445 item 5 (backend, Pista B): anexos de foto e PDF no chat.
-- Bucket PRIVADO "mensagens-anexos" (10 MB; JPG, PNG, WebP e PDF) SEM política de storage para o navegador: o arquivo
-- entra e sai só pelo servidor (service role), que devolve URL assinada de 10 minutos a quem está na conversa.
-- A tabela liga o arquivo à mensagem; ler é só das partes (remetente e destinatário); escrever é só do servidor.
-- Só cria coisa nova. Sem DROP, sem dado pessoal (o nome do arquivo não é guardado).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mensagens-anexos', 'mensagens-anexos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create table if not exists public.mensagens_anexos (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  conversation_id uuid not null,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  caminho text not null unique,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  tamanho integer not null check (tamanho > 0 and tamanho <= 10485760),
  hash_sha256 text not null,
  created_at timestamptz not null default now()
);

create index if not exists mensagens_anexos_message_idx on public.mensagens_anexos (message_id);
create index if not exists mensagens_anexos_conversa_idx on public.mensagens_anexos (conversation_id, created_at);

alter table public.mensagens_anexos enable row level security;

drop policy if exists "anexos das partes" on public.mensagens_anexos;
create policy "anexos das partes" on public.mensagens_anexos
  for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

revoke all on public.mensagens_anexos from anon, authenticated;
grant select on public.mensagens_anexos to authenticated;
grant all on public.mensagens_anexos to service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261104000288', '0288_mensagens_anexos', array['-- conteúdo em supabase/migrations/0288_mensagens_anexos.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261104000288');
commit;

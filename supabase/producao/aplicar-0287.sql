-- Viva Nomads — aplicar 0287 (E445: links protegidos no banco, leitura das mensagens e fila de ofensas). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0287_rollback.sql.
begin;
set local lock_timeout = '5s';

-- E445 (Relay 57, itens 1, 3 e 4 — Pista B): mensagens. A regra "contato nunca é liberado" segue (decisão do Daniel).
-- 1. mask_contact (gatilho do banco, defesa em profundidade do contact-guard.ts): TODO link externo é mascarado;
--    só vivanomads.com.br passa. As regras antigas (mensageria, e-mail, telefone, rede social, @handle) seguem iguais.
create or replace function public.mask_contact(t text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  r text := t;
  m text;
  k constant text := '🔒 [contato protegido]';
  kl constant text := '🔒 [link protegido]';
begin
  if r is null then
    return null;
  end if;
  r := regexp_replace(r, '(https?://)?(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me)/\S+', k, 'gi');
  r := regexp_replace(r, '[[:alnum:]_.+-]+@[[:alnum:]_-]+\.[[:alnum:]_.-]{2,}', k, 'g');
  r := regexp_replace(r, '(https?://)?(www\.)?(instagram|facebook|fb|tiktok)\.com/\S+', k, 'gi');
  -- E445: links externos (http/https, www., encurtadores e domínio com terminação comum), exceto o site da Viva.
  for m in
    select (regexp_matches(
      r,
      '(https?://[^[:space:]<>"'']+|\mwww\.[^[:space:]<>"'']+|\m([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+(com\.br|net\.br|org\.br|com|net|org|br|io|me|ly|co|app|link|site|info|biz|xyz|gl|gd|to|tv|online|store|page|ws|cc)\M([/?#][^[:space:]<>"'']*)?)',
      'gi'))[1]
  loop
    if m !~* '^(https?://)?(www\.)?([a-z0-9-]+\.)*vivanomads\.com\.br([/?#:]|[.,;!)]*$)' then
      r := replace(r, m, kl);
    end if;
  end loop;
  for m in select (regexp_matches(r, '\+?\d[[:digit:][:space:]().-]{7,}\d', 'g'))[1] loop
    if length(regexp_replace(m, '\D', '', 'g')) between 10 and 13 then
      r := replace(r, m, k);
    end if;
  end loop;
  r := regexp_replace(r, '(^|[^[:alnum:]_@])@[A-Za-z0-9._]{2,30}', '\1' || k, 'g');
  return r;
end;
$$;

-- 4. Leitura: lido_em por destinatário (a mensagem tem um destinatário só). Só o destinatário marca, e só essa coluna.
alter table public.messages add column if not exists lido_em timestamptz;
create index if not exists messages_nao_lidas on public.messages (receiver_id, conversation_id) where lido_em is null;
revoke update on public.messages from anon, authenticated;
grant update (lido_em) on public.messages to authenticated;
drop policy if exists "destinatario marca lido" on public.messages;
create policy "destinatario marca lido" on public.messages
  for update to authenticated using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());

-- Não lidas por conversa (as do próprio usuário). O total é a soma; alimenta o sino (E444) como "urgente".
create or replace function public.mensagens_nao_lidas()
returns table (conversation_id uuid, nao_lidas integer)
language sql
stable
security invoker
set search_path = public
as $$
  select m.conversation_id, count(*)::integer
  from public.messages m
  where m.receiver_id = auth.uid() and m.lido_em is null
  group by m.conversation_id
$$;
revoke all on function public.mensagens_nao_lidas() from public, anon;
grant execute on function public.mensagens_nao_lidas() to authenticated, service_role;

-- 3. Ofensas: a pessoa foi avisada e enviou mesmo assim → registro na fila de moderação (quem, conversa, termo).
create table if not exists public.moderacao_ofensas (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null,
  message_id uuid references public.messages (id) on delete set null,
  termo text not null check (char_length(termo) between 1 and 80),
  criado_em timestamptz not null default now(),
  revisado_em timestamptz,
  revisado_por uuid references public.profiles (id) on delete set null
);
create index if not exists moderacao_ofensas_autor on public.moderacao_ofensas (autor_id, criado_em desc);
create index if not exists moderacao_ofensas_fila on public.moderacao_ofensas (criado_em desc) where revisado_em is null;
alter table public.moderacao_ofensas enable row level security;
drop policy if exists moderacao_ofensas_admin on public.moderacao_ofensas;
create policy moderacao_ofensas_admin on public.moderacao_ofensas for select to authenticated using (public.is_admin());
revoke all on public.moderacao_ofensas from anon, authenticated;
grant select on public.moderacao_ofensas to authenticated;
grant all on public.moderacao_ofensas to service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261102000287', '0287_mensagens_protecoes_leitura', array['-- conteúdo em supabase/migrations/0287_mensagens_protecoes_leitura.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261102000287');
commit;

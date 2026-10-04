-- ════════════════════════════════════════════════════════════════════════════
-- 0052 — P0 de segurança, PARTE 1 (COMPATÍVEL). Aplicar ANTES do merge do PR.
--
-- Esta parte NÃO quebra o código que está hoje na `main`:
--   • não mexe no SELECT de properties (a main ainda usa select("*"));
--   • não tira o execute das RPCs de contato (a main ainda as chama pela sessão).
-- Isso fica para a 0053, aplicada DEPOIS que o deploy do merge estiver no ar.
--
--   C1   handle_new_user só aceita 'owner' | 'tenant'.
--   PJ1  handle_new_user grava person_type (pf|pj) escolhido no cadastro.
--   C2   UPDATE de profiles só nas colunas de preferência + trigger de confiança.
--   C3a  RLS nova de leads e messages (relação real entre as partes).
--   C4a  RPC property_private_details; limpeza do draft_data dos anúncios ativos
--        (com cópia de segurança para o rollback).
--   prep grant de execute das 4 RPCs de contato ao service_role (o código novo
--        as chama pelo servidor) — aditivo, não tira nada de ninguém.
--
-- Rollback: supabase/producao/rollback/0052_rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── C1 + PJ1 — handle_new_user ──────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, person_type)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    -- C1: SÓ owner|tenant. Qualquer outro valor (inclusive 'admin') → 'tenant'.
    case
      when new.raw_user_meta_data ->> 'role' in ('owner', 'tenant')
        then (new.raw_user_meta_data ->> 'role')::user_role
      else 'tenant'::user_role
    end,
    -- PJ1: a escolha PF/PJ do cadastro era descartada (todos ficavam 'pf').
    case
      when new.raw_user_meta_data ->> 'person_type' = 'pj' then 'pj'::person_type
      else 'pf'::person_type
    end
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    raise warning 'handle_new_user: % (%):', sqlerrm, sqlstate;
    return new;
end;
$$;

-- ── C2 — perfil próprio não reescreve role/confiança ────────────────────────
revoke update on public.profiles from authenticated, anon;
grant update (
  full_name, phone, avatar_url, avatar_atualizado_em, preferred_mode,
  professional_category, linkedin_url, company_name, needs_nfse,
  notif_email, notif_whatsapp
) on public.profiles to authenticated;

-- ATENÇÃO: SECURITY INVOKER de propósito. Numa função SECURITY DEFINER,
-- current_user vira o DONO da função (postgres) e a checagem abaixo passaria
-- SEMPRE — o trigger não bloquearia nada. Como INVOKER, current_user é quem faz
-- o UPDATE: 'authenticated'/'anon' (bloqueado), 'service_role' (servidor) ou
-- 'postgres' (migrações e funções SECURITY DEFINER do banco, ex.: anonimizar_conta).
create or replace function public.profiles_bloqueia_confianca()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- service_role (server actions) e papéis de migração podem tudo; usuário não.
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;
  if new.role                  is distinct from old.role
     or new.email                 is distinct from old.email
     or new.is_verified           is distinct from old.is_verified
     or new.verification_progress is distinct from old.verification_progress
     or new.fundador              is distinct from old.fundador
     or new.fundador_em           is distinct from old.fundador_em
     or new.account_type          is distinct from old.account_type
     or new.cpf                   is distinct from old.cpf
     or new.person_type           is distinct from old.person_type
     or new.anonymized_at         is distinct from old.anonymized_at
  then
    raise exception 'Alteração de campo protegido do perfil não permitida'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_bloqueia_confianca on public.profiles;
create trigger trg_profiles_bloqueia_confianca
  before update on public.profiles
  for each row execute function public.profiles_bloqueia_confianca();

-- ── C3a — leads e messages só com relação real ──────────────────────────────
-- leads INSERT: só o próprio inquilino, status 'new', e owner_id = dono REAL de
-- um imóvel ATIVO (não dá para forjar owner_id nem status).
drop policy if exists "inquilino cria lead" on public.leads;
create policy "inquilino cria lead" on public.leads
  for insert with check (
    tenant_id = auth.uid()
    and status = 'new'
    and exists (
      select 1 from public.properties p
      where p.id = leads.property_id
        and p.status = 'active'
        and p.owner_id = leads.owner_id
    )
  );

-- Relação por Pedido de Moradia entre QUEM CHAMA e `outro` (os dois sentidos).
-- SECURITY DEFINER porque o proprietário NÃO pode ler pedidos_moradia (RLS: só
-- o inquilino dono) — sem isso, o subselect da política voltaria vazio para o
-- lado do proprietário. Só responde sobre a relação do próprio chamador.
create or replace function public.tem_relacao_pedido_com(outro uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.respostas_pedido r
    join public.pedidos_moradia pm on pm.id = r.pedido_id
    where (r.proprietario_id = auth.uid() and pm.inquilino_id = outro)
       or (pm.inquilino_id    = auth.uid() and r.proprietario_id = outro)
  );
$$;
revoke all on function public.tem_relacao_pedido_com(uuid) from public, anon;
grant execute on function public.tem_relacao_pedido_com(uuid) to authenticated;

-- messages INSERT: remetente é quem está logado E existe relação real:
--   (a) um lead entre as partes (dúvida, visita ou candidatura — qualquer status);
--   (b) uma resposta a Pedido de Moradia entre as partes (os dois sentidos);
--   (c) 1º contato SOBRE um anúncio ATIVO (com property_id), para o DONO dele,
--       e o remetente não é o dono (ex.: "Solicitar reserva", que abre a
--       conversa sem lead — sai no P1, quando a reserva criar lead);
--   (d) resposta a quem já te escreveu NA MESMA conversa (conversation_id).
-- Antes, bastava sender_id = auth.uid(): dava para "mandar mensagem" a qualquer
-- uuid e forjar a relação que liberava o contato (message_notify_contact).
drop policy if exists "enviar mensagem" on public.messages;
create policy "enviar mensagem" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (
      exists (
        select 1 from public.leads l
        where (l.tenant_id = auth.uid() and l.owner_id = messages.receiver_id)
           or (l.owner_id  = auth.uid() and l.tenant_id = messages.receiver_id)
      )
      or public.tem_relacao_pedido_com(messages.receiver_id)
      -- (c) 1º contato: COM property_id, para o DONO desse imóvel ATIVO, e o
      --     remetente não é o próprio dono. (Sai no P1, quando "Solicitar
      --     reserva" passar a criar lead.)
      or (
        messages.property_id is not null
        and exists (
          select 1 from public.properties p
          where p.id = messages.property_id
            and p.status = 'active'
            and p.owner_id = messages.receiver_id
            and p.owner_id <> auth.uid()
        )
      )
      -- (d) resposta só a quem já te escreveu NESTA conversa (mesmo
      --     conversation_id, que já carrega o imóvel), não a qualquer pessoa.
      or (
        messages.conversation_id is not null
        and exists (
          select 1 from public.messages m
          where m.sender_id = messages.receiver_id
            and m.receiver_id = auth.uid()
            and m.conversation_id = messages.conversation_id
        )
      )
    )
  );

-- ── C4a — RPC de detalhes privados ──────────────────────────────────────────
-- Endereço exato + responsável local: dono, inquilino com candidatura ACEITA
-- naquele imóvel, ou admin. draft_data: só o dono.
create or replace function public.property_private_details(prop_id uuid)
returns table (
  exact_address text,
  responsavel_local_nome text,
  responsavel_local_telefone text,
  responsavel_local_email text,
  draft_data jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    p.exact_address,
    p.responsavel_local_nome,
    p.responsavel_local_telefone,
    p.responsavel_local_email,
    case when p.owner_id = auth.uid() then p.draft_data else null end
  from public.properties p
  where p.id = prop_id
    and (
      p.owner_id = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from public.leads l
        where l.property_id = p.id
          and l.tenant_id = auth.uid()
          and l.status = 'accepted'
      )
    )
  limit 1;
$$;

revoke all on function public.property_private_details(uuid) from public, anon;
grant execute on function public.property_private_details(uuid) to authenticated;

-- ── prep — service_role executa as RPCs de contato (aditivo) ────────────────
grant execute on function public.owner_notify_contact(uuid)       to service_role;
grant execute on function public.message_notify_contact(uuid)     to service_role;
grant execute on function public.pedido_owner_recipients(text)    to service_role;
grant execute on function public.pedido_inquilino_recipient(uuid) to service_role;

-- ── C4a — draft_data dos anúncios já ativos (a RUA exata) ───────────────────
-- Cópia de segurança SÓ para o rollback: tabela sem acesso para anon/
-- authenticated (RLS ligada e sem políticas). Apague após confirmar que está
-- tudo bem (ver o fim do verificar-seguranca.sql).
create table if not exists public._backup_p0_draft_data (
  property_id uuid primary key,
  draft_data jsonb,
  migracao text not null,
  salvo_em timestamptz not null default now()
);
alter table public._backup_p0_draft_data enable row level security;
revoke all on public._backup_p0_draft_data from anon, authenticated;

insert into public._backup_p0_draft_data (property_id, draft_data, migracao)
select id, draft_data, '0052'
from public.properties
where status = 'active' and draft_data is not null
on conflict (property_id) do nothing;

update public.properties set draft_data = null
 where status = 'active' and draft_data is not null;

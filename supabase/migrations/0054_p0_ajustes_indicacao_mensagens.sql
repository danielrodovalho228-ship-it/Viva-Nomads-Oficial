-- ════════════════════════════════════════════════════════════════════════════
-- 0054 — Ajustes do P0 (pedidos na revisão do #217, que foi mergeado sem eles).
-- Aplicar DEPOIS da 0052. Independe da 0053 (pode vir antes ou depois dela).
-- Tudo aqui é "create or replace" / "drop policy if exists": reaplicar é seguro.
--
--   IND  profiles.referral_code existia (0003) mas nunca era gravado, e o código
--        digitado no cadastro era descartado. Agora: gerar_referral_code (mesma
--        fórmula da tela), backfill das contas existentes, e handle_new_user
--        grava referred_by (código → uuid; inválido ou o próprio → nulo) e gera
--        o código de cada cadastro novo.
--   C2   o trigger de confiança também trava referred_by e referral_code.
--   C3a  "enviar mensagem", caso (d): resposta só NA MESMA conversa E sobre o
--        MESMO imóvel (property_id igual, ou os dois nulos).
--
-- Rollback: supabase/producao/rollback/0054_rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── Indicação — código gravado no banco ─────────────────────────────────────
-- profiles.referral_code existia (0003) mas NUNCA era preenchido: a página de
-- indicações calculava o código no navegador e o cadastro descartava o código
-- digitado. Mesma fórmula da tela (VIVA-<1º nome, só A–Z, até 8><3 primeiros
-- caracteres do id>), para os links já compartilhados continuarem valendo. Em
-- colisão (código já usado por outra pessoa) alonga o sufixo com o id.
create or replace function public.gerar_referral_code(nome text, uid uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  primeiro text := split_part(coalesce(nome, ''), ' ', 1);
  hex text := upper(replace(uid::text, '-', ''));
  base text;
  cod text;
  n int := 3;
begin
  if primeiro = '' then primeiro := 'VIVA'; end if;
  base := 'VIVA-' || left(regexp_replace(upper(primeiro), '[^A-Z]', '', 'g'), 8);
  loop
    cod := base || left(hex, n);
    exit when not exists (
      select 1 from public.profiles where referral_code = cod and id <> uid
    );
    n := n + 1;
    if n > 32 then return null; end if;
  end loop;
  return cod;
end;
$$;
revoke all on function public.gerar_referral_code(text, uuid) from public, anon, authenticated;

-- Contas já existentes ganham o código (o mesmo que a tela já mostrava).
do $$
declare r record;
begin
  for r in
    select id, coalesce(full_name, email) as nome
      from public.profiles
     where referral_code is null and anonymized_at is null
     order by created_at, id
  loop
    update public.profiles
       set referral_code = public.gerar_referral_code(r.nome, r.id)
     where id = r.id;
  end loop;
end;
$$;

-- ── handle_new_user: C1 + PJ1 (iguais à 0052) + indicação ──────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cod_indicacao text := upper(trim(coalesce(new.raw_user_meta_data ->> 'referred_by', '')));
  indicador uuid;
begin
  -- Indicação: resolve o código digitado para o uuid de quem indicou. Código
  -- inválido (ou do próprio usuário) é ignorado — o cadastro nunca falha por isso.
  -- Aceita com ou sem o prefixo "VIVA-".
  if cod_indicacao <> '' then
    select p.id into indicador
      from public.profiles p
     where p.referral_code in (cod_indicacao, 'VIVA-' || cod_indicacao)
       and p.id <> new.id
       and p.anonymized_at is null
     limit 1;
  end if;

  insert into public.profiles (id, full_name, email, role, person_type, referred_by)
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
    end,
    indicador
  )
  on conflict (id) do nothing;

  -- Código próprio de indicação, em bloco separado: se algo der errado aqui, o
  -- perfil (já gravado acima) fica, só sem código.
  begin
    update public.profiles
       set referral_code = public.gerar_referral_code(
             coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email), new.id)
     where id = new.id and referral_code is null;
  exception
    when others then
      raise warning 'handle_new_user (referral_code): % (%):', sqlerrm, sqlstate;
  end;
  return new;
exception
  when others then
    raise warning 'handle_new_user: % (%):', sqlerrm, sqlstate;
    return new;
end;
$$;

-- ── C2 — trigger de confiança (agora com referred_by e referral_code) ───────
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
     or new.referred_by           is distinct from old.referred_by
     or new.referral_code         is distinct from old.referral_code
  then
    raise exception 'Alteração de campo protegido do perfil não permitida'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ── C3a — política de mensagens com o caso (d) limitado ao mesmo imóvel ─────
-- messages INSERT: remetente é quem está logado E existe relação real:
--   (a) um lead entre as partes (dúvida, visita ou candidatura — qualquer status);
--   (b) uma resposta a Pedido de Moradia entre as partes (os dois sentidos);
--   (c) 1º contato SOBRE um anúncio ATIVO (com property_id), para o DONO dele,
--       e o remetente não é o dono (ex.: "Solicitar reserva", que abre a
--       conversa sem lead — sai no P1, quando a reserva criar lead);
--   (d) resposta a quem já te escreveu NA MESMA conversa e sobre o MESMO imóvel.
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
      -- (d) resposta só a quem já te escreveu NESTA conversa e SOBRE O MESMO
      --     imóvel (property_id igual, ou os dois nulos) — não a qualquer
      --     mensagem anterior daquela pessoa.
      or (
        messages.conversation_id is not null
        and exists (
          select 1 from public.messages m
          where m.sender_id = messages.receiver_id
            and m.receiver_id = auth.uid()
            and m.conversation_id = messages.conversation_id
            and m.property_id is not distinct from messages.property_id
        )
      )
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK da 0054 (p0_ajustes_indicacao_mensagens). Volta ao estado da 0052.
--
-- Os referral_code/referred_by já gravados FICAM (são só dados; a tela calcula
-- o mesmo código). Se for desfazer também a 0052, rode este PRIMEIRO.
-- Rode tudo de uma vez no SQL Editor (é uma transação).
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- handle_new_user exatamente como na 0052 (sem indicação).
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

-- Trigger de confiança exatamente como na 0052.
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

-- Política de mensagens exatamente como na 0052 (caso (d) só por conversation_id).
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

drop function if exists public.gerar_referral_code(text, uuid);

commit;

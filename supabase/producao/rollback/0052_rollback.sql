-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK da 0052 (p0_seguranca_compativel). Volta ao estado ANTERIOR.
--
-- ⚠️ Desfazer a 0052 REABRE os furos C1/C2 (cadastro como admin, auto-edição do
--    role). Use só como saída rápida se algo quebrar, e corrija em seguida.
-- ⚠️ Se a 0053 já foi aplicada, rode PRIMEIRO o 0053_rollback.sql.
-- Rode tudo de uma vez no SQL Editor (é uma transação).
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- C1 + PJ1 — handle_new_user exatamente como na 0013.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    -- Papel escolhido no cadastro; valor inválido/ausente → 'tenant' (sem cast quebrar).
    case
      when new.raw_user_meta_data ->> 'role' in ('owner', 'tenant', 'admin')
        then (new.raw_user_meta_data ->> 'role')::user_role
      else 'tenant'::user_role
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

-- C2 — sem trigger e UPDATE de volta na tabela inteira (padrão do Supabase).
drop trigger if exists trg_profiles_bloqueia_confianca on public.profiles;
drop function if exists public.profiles_bloqueia_confianca();
revoke update (
  full_name, phone, avatar_url, avatar_atualizado_em, preferred_mode,
  professional_category, linkedin_url, company_name, needs_nfse,
  notif_email, notif_whatsapp
) on public.profiles from authenticated;
grant update on public.profiles to authenticated, anon;

-- C3a — políticas originais de leads (0017) e messages (0001).
drop policy if exists "inquilino cria lead" on public.leads;
create policy "inquilino cria lead" on public.leads
  for insert with check (tenant_id = auth.uid());

drop policy if exists "enviar mensagem" on public.messages;
create policy "enviar mensagem" on public.messages
  for insert with check (sender_id = auth.uid());

-- C4a — RPC nova sai.
drop function if exists public.property_private_details(uuid);

-- C3a — função auxiliar da relação por Pedido sai (depois da política que a usa).
drop function if exists public.tem_relacao_pedido_com(uuid);

-- draft_data — devolve o que a 0052 limpou (só linhas que ainda estão vazias).
update public.properties p
   set draft_data = b.draft_data
  from public._backup_p0_draft_data b
 where b.property_id = p.id and b.migracao = '0052' and p.draft_data is null;
delete from public._backup_p0_draft_data where migracao = '0052';

-- Observação: o grant de execute das 4 RPCs ao service_role é mantido (era
-- aditivo e o service_role já podia executá-las pelo padrão do Supabase).

commit;

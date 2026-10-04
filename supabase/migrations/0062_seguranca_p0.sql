-- ─────────────────────────────────────────────────────────────────────────────
-- 0062 — segurança P0 (auditoria dos 5 agentes). Idempotente.
--
--  1. "Qualquer conta vira ADMIN": profiles deixava o usuário APAGAR o próprio
--     perfil e RECRIÁ-LO com role='admin' (o trigger da 0052 só olha UPDATE).
--  2. Dono não conseguia responder Pedido de Moradia: a política de INSERT de
--     respostas_pedido lia pedidos_moradia, que a RLS esconde do dono.
--  3. Avaliações forjáveis: property_reviews (dono FOR ALL → 5★ no próprio
--     imóvel) e avaliacoes (contrato nulo, autor = alvo).
--  4. avatar_url sai do grant de coluna (só o servidor grava o caminho).
--  5. Pedido 'removido_admin' só volta pela moderação.
--  6. email_existe deixa de ser chamável por anon/authenticated (enumeração).
--  7. Limites de tamanho/tipo nos buckets avatars e vistoria-fotos.
--  8. Vistoria não é apagada; status/selo só pelo servidor.
--  9. leads.reject_reason fora do SELECT do usuário (grant por coluna).
-- 10. Trocar a foto de perfil (upsert) precisa de UPDATE em storage.objects.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. profiles ─────────────────────────────────────────────────────────────
-- Cadastro: trigger handle_new_user (SECURITY DEFINER). Exclusão:
-- delete_user_account / anonimizar_conta (SECURITY DEFINER). O site nunca
-- cria nem apaga perfil pelo cliente do usuário.
revoke insert, delete on public.profiles from anon, authenticated;

drop policy if exists "perfil próprio" on public.profiles;
drop policy if exists "perfil próprio: lê" on public.profiles;
create policy "perfil próprio: lê" on public.profiles for select using (auth.uid() = id);
drop policy if exists "perfil próprio: atualiza" on public.profiles;
create policy "perfil próprio: atualiza" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- Cinto extra: se um dia o INSERT voltar a ser concedido, quem não é servidor
-- nunca nasce admin/gestor/verificado. SECURITY INVOKER de propósito (ver 0052):
-- em handle_new_user (DEFINER) current_user é o dono da função → servidor.
create or replace function public.profiles_insert_seguro()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;
  if coalesce(new.role, 'tenant') not in ('tenant', 'owner') then
    new.role := 'tenant';
  end if;
  new.account_type := 'individual';
  new.verification_progress := 0;
  return new;
end;
$$;
drop trigger if exists trg_profiles_insert_seguro on public.profiles;
create trigger trg_profiles_insert_seguro
  before insert on public.profiles
  for each row execute function public.profiles_insert_seguro();

-- ── 2. respostas_pedido: o dono vê se o pedido está ativo (sem ver o pedido) ─
create or replace function public.pedido_ativo(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.pedidos_moradia where id = p and status = 'ativo');
$$;
revoke all on function public.pedido_ativo(uuid) from public;
grant execute on function public.pedido_ativo(uuid) to authenticated, service_role;

drop policy if exists "proprietario cria resposta" on public.respostas_pedido;
create policy "proprietario cria resposta" on public.respostas_pedido for insert with check (
  proprietario_id = auth.uid()
  and exists (select 1 from public.properties im
               where im.id = respostas_pedido.imovel_id
                 and im.owner_id = auth.uid()
                 and im.status = 'active')
  and public.pedido_ativo(respostas_pedido.pedido_id)
);

-- ── 3. avaliações: só o servidor grava; contrato encerrado; autor ≠ alvo ────
drop policy if exists "dono gerencia avaliações de imóvel" on public.property_reviews;
revoke insert, update, delete on public.property_reviews from anon, authenticated;

drop policy if exists "autor cria avaliação" on public.avaliacoes;
drop policy if exists "autor avalia" on public.avaliacoes;
revoke insert, update, delete on public.avaliacoes from anon, authenticated;

create or replace function public.avaliacao_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  if new.contrato_id is null then
    raise exception 'Avaliação precisa de um contrato.' using errcode = '23514';
  end if;
  if new.autor_id = new.alvo_id then
    raise exception 'Ninguém avalia a si mesmo.' using errcode = '23514';
  end if;
  select ct.status, ct.tenant_id, pr.owner_id
    into c
    from public.contratos ct
    join public.properties pr on pr.id = ct.property_id
   where ct.id = new.contrato_id;
  if not found then
    raise exception 'Contrato não encontrado.' using errcode = '23514';
  end if;
  if c.status not in ('concluido', 'encerrado_sem_renovacao', 'encerrado_em_acerto') then
    raise exception 'Só é possível avaliar depois do fim do contrato.' using errcode = '23514';
  end if;
  if not ((new.autor_id = c.tenant_id and new.alvo_id = c.owner_id)
       or (new.autor_id = c.owner_id and new.alvo_id = c.tenant_id)) then
    raise exception 'Autor e avaliado precisam ser as partes do contrato.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_avaliacao_valida on public.avaliacoes;
create trigger trg_avaliacao_valida
  before insert or update on public.avaliacoes
  for each row execute function public.avaliacao_valida();

-- ── 4. avatar_url: só o servidor grava (o caminho é sempre <uid>/avatar.webp) ─
revoke update (avatar_url) on public.profiles from authenticated;

-- ── 5. pedido removido pela moderação só volta pela moderação ───────────────
create or replace function public.pedido_moderacao_protegida()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') or public.is_admin() then
    return new;
  end if;
  if old.status = 'removido_admin' and new.status is distinct from old.status then
    raise exception 'Pedido removido pela moderação.' using errcode = '42501';
  end if;
  if new.status = 'removido_admin' and old.status is distinct from 'removido_admin' then
    raise exception 'Só a moderação remove pedidos.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_pedido_moderacao_protegida on public.pedidos_moradia;
create trigger trg_pedido_moderacao_protegida
  before update on public.pedidos_moradia
  for each row execute function public.pedido_moderacao_protegida();

-- ── 6. email_existe: só o servidor (rota com limite por IP) ─────────────────
revoke all on function public.email_existe(text) from public, anon, authenticated;
grant execute on function public.email_existe(text) to service_role;

-- ── 7. limites dos buckets de imagem (o de documentos já tem — 0040) ────────
do $$
begin
  update storage.buckets
     set file_size_limit = 8388608,
         allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
   where id in ('avatars', 'vistoria-fotos');
exception when undefined_column then
  null; -- ambiente sem as colunas de limite (teste local)
end;
$$;

-- ── 8. vistorias: sem DELETE; status e selo só pelo servidor ────────────────
drop policy if exists "vistorias: partes escrevem" on public.vistorias;
drop policy if exists "vistorias: partes criam" on public.vistorias;
create policy "vistorias: partes criam" on public.vistorias for insert to authenticated
  with check (public.pode_ver_contrato(contrato_id) and status = 'rascunho' and selada_em is null);
drop policy if exists "vistorias: partes editam rascunho" on public.vistorias;
create policy "vistorias: partes editam rascunho" on public.vistorias for update to authenticated
  using (public.pode_ver_contrato(contrato_id) and status <> 'assinada')
  with check (public.pode_ver_contrato(contrato_id));
revoke delete on public.vistorias from anon, authenticated;

create or replace function public.vistoria_transicao_servidor()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.selada_em is distinct from old.selada_em
     or new.fotos_hash is distinct from old.fotos_hash
     or new.executor_confirmou_em is distinct from old.executor_confirmou_em
     or new.inquilino_confirmou_em is distinct from old.inquilino_confirmou_em
     or new.contrato_id is distinct from old.contrato_id
  then
    raise exception 'Etapas da vistoria são feitas pelo servidor.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_vistoria_transicao_servidor on public.vistorias;
create trigger trg_vistoria_transicao_servidor
  before update on public.vistorias
  for each row execute function public.vistoria_transicao_servidor();

-- Itens e fotos de vistoria SELADA também não mudam nem somem.
create or replace function public.vistoria_filho_selado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vid uuid;
begin
  if tg_table_name = 'vistoria_itens' then
    vid := coalesce(new.vistoria_id, old.vistoria_id);
  else
    select i.vistoria_id into vid from public.vistoria_itens i
     where i.id = coalesce(new.item_id, old.item_id);
  end if;
  if exists (select 1 from public.vistorias v where v.id = vid and v.status = 'assinada') then
    raise exception 'Vistoria assinada é imutável (prova selada).' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_vistoria_itens_selado on public.vistoria_itens;
create trigger trg_vistoria_itens_selado
  before insert or update or delete on public.vistoria_itens
  for each row execute function public.vistoria_filho_selado();
drop trigger if exists trg_vistoria_fotos_selado on public.vistoria_fotos;
create trigger trg_vistoria_fotos_selado
  before insert or update or delete on public.vistoria_fotos
  for each row execute function public.vistoria_filho_selado();

-- ── 9. leads: o motivo da recusa não volta para o usuário ───────────────────
revoke select on public.leads from anon, authenticated;
grant select (
  id, owner_id, tenant_id, property_id, status, created_at, contact_unlocked,
  accepted_at, rejected_at, decided_by, accepted_plan, accepted_commission_rate
) on public.leads to authenticated;

-- ── 10. avatars: upsert (trocar a foto) precisa de UPDATE ───────────────────
drop policy if exists "avatars: dono troca" on storage.objects;
create policy "avatars: dono troca" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Conferência (rodar depois):
--   select has_table_privilege('authenticated','public.profiles','INSERT'),   -- false
--          has_table_privilege('authenticated','public.profiles','DELETE'),   -- false
--          has_function_privilege('anon','public.email_existe(text)','execute'), -- false
--          has_column_privilege('authenticated','public.leads','reject_reason','select'); -- false
--   select policyname from pg_policies where tablename in ('profiles','respostas_pedido','vistorias') order by 1;

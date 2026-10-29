-- 0252 — QA-LOGIN-B v2: admin observador da Muse e o tipo/destino no registro da porta de QA (0251).
-- profiles.qa_admin (só o servidor liga), is_qa_admin(uid), promover/revogar_qa_admin (só service role) e a Caixa
-- dos Sócios fechada para o observador na RLS. is_admin() e a regra do 2FA NÃO mudam. Idempotente.
-- 1. O registro da 0251 ganha o tipo da entrada e o caminho de destino (sem query).
alter table public.qa_entradas add column if not exists tipo text not null default 'teste';
alter table public.qa_entradas add column if not exists destino text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'qa_entradas_tipo_chk') then
    alter table public.qa_entradas add constraint qa_entradas_tipo_chk check (tipo in ('teste', 'admin_qa'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'qa_entradas_destino_chk') then
    alter table public.qa_entradas add constraint qa_entradas_destino_chk check (destino is null or length(destino) <= 200);
  end if;
end $$;
create index if not exists qa_entradas_admin_qa_idx on public.qa_entradas (criado_em) where tipo = 'admin_qa';

-- 2. Admin observador da QA. Só o servidor (service role / migração) liga: uma pessoa logada não consegue se marcar.
alter table public.profiles add column if not exists qa_admin boolean not null default false;

create or replace function public.profiles_qa_admin_so_servidor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), 'service_role') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.qa_admin := false;
    else
      new.qa_admin := old.qa_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_qa_admin_guarda on public.profiles;
create trigger profiles_qa_admin_guarda
  before insert or update on public.profiles
  for each row execute function public.profiles_qa_admin_so_servidor();

-- is_qa_admin(uid): a conta é o admin observador da QA? is_admin() e a regra do 2FA NÃO mudam.
create or replace function public.is_qa_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.qa_admin from public.profiles p where p.id = uid), false);
$$;
revoke all on function public.is_qa_admin(uuid) from public, anon;
grant execute on function public.is_qa_admin(uuid) to authenticated, service_role;

-- Rotina de serviço: promove UMA conta de teste a admin observador (role admin + qa_admin), ou desfaz.
-- Só o service role executa (a Action "Admin observador da QA" chama com o id da conta; nenhum e-mail no código).
create or replace function public.promover_qa_admin(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = p_id and is_teste) then
    raise exception 'a conta precisa existir e ser de teste (is_teste)' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.profiles where qa_admin and id <> p_id) then
    raise exception 'já existe um admin observador da QA; desfaça o atual antes' using errcode = 'check_violation';
  end if;
  update public.profiles set role = 'admin', qa_admin = true where id = p_id;
end;
$$;

create or replace function public.revogar_qa_admin(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set role = 'tenant', qa_admin = false where id = p_id and qa_admin;
end;
$$;
revoke all on function public.promover_qa_admin(uuid) from public, anon, authenticated;
revoke all on function public.revogar_qa_admin(uuid) from public, anon, authenticated;
grant execute on function public.promover_qa_admin(uuid) to service_role;
grant execute on function public.revogar_qa_admin(uuid) to service_role;

-- 3. Caixa dos Sócios fora do alcance do admin observador, também pela RLS (tabela e arquivos).
drop policy if exists "caixa_socios: admin le" on public.caixa_socios;
create policy "caixa_socios: admin le" on public.caixa_socios for select to authenticated
  using (public.is_admin() and not public.is_qa_admin(auth.uid()));
drop policy if exists "caixa_socios: admin envia" on public.caixa_socios;
create policy "caixa_socios: admin envia" on public.caixa_socios for insert to authenticated
  with check (public.is_admin() and not public.is_qa_admin(auth.uid()) and autor = auth.uid() and status = 'novo' and resposta is null);
drop policy if exists "caixa_socios: admin atualiza" on public.caixa_socios;
create policy "caixa_socios: admin atualiza" on public.caixa_socios for update to authenticated
  using (public.is_admin() and not public.is_qa_admin(auth.uid())) with check (public.is_admin() and not public.is_qa_admin(auth.uid()));
drop policy if exists "caixa-socios: admin le" on storage.objects;
create policy "caixa-socios: admin le" on storage.objects for select to authenticated
  using (bucket_id = 'caixa-socios' and public.is_admin() and not public.is_qa_admin(auth.uid()));
drop policy if exists "caixa-socios: admin envia" on storage.objects;
create policy "caixa-socios: admin envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'caixa-socios' and public.is_admin() and not public.is_qa_admin(auth.uid()) and (storage.foldername(name))[1] = auth.uid()::text);

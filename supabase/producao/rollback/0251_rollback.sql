-- Viva Nomads — rollback da 0251: tira a porta de QA e o admin observador; a Caixa dos Sócios volta à política da 0107.
begin;
set local lock_timeout = '5s';
-- Quem era admin observador deixa de ser admin.
update public.profiles set role = 'tenant' where qa_admin;
drop policy if exists "caixa_socios: admin le" on public.caixa_socios;
create policy "caixa_socios: admin le" on public.caixa_socios for select to authenticated using (public.is_admin());
drop policy if exists "caixa_socios: admin envia" on public.caixa_socios;
create policy "caixa_socios: admin envia" on public.caixa_socios for insert to authenticated
  with check (public.is_admin() and autor = auth.uid() and status = 'novo' and resposta is null);
drop policy if exists "caixa_socios: admin atualiza" on public.caixa_socios;
create policy "caixa_socios: admin atualiza" on public.caixa_socios for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "caixa-socios: admin le" on storage.objects;
create policy "caixa-socios: admin le" on storage.objects for select to authenticated
  using (bucket_id = 'caixa-socios' and public.is_admin());
drop policy if exists "caixa-socios: admin envia" on storage.objects;
create policy "caixa-socios: admin envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'caixa-socios' and public.is_admin() and (storage.foldername(name))[1] = auth.uid()::text);
drop function if exists public.promover_qa_admin(uuid);
drop function if exists public.revogar_qa_admin(uuid);
drop function if exists public.is_qa_admin(uuid);
drop trigger if exists profiles_qa_admin_guarda on public.profiles;
drop function if exists public.profiles_qa_admin_so_servidor();
alter table public.profiles drop column if exists qa_admin;
drop table if exists public.qa_entradas;
delete from supabase_migrations.schema_migrations where version = '20261028000251';
commit;

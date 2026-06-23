-- ════════════════════════════════════════════════════════════════════
-- Acesso real (Fase 7) — políticas de ADMIN por papel.
-- (Renumerado de 0009 → 0011 para não colidir com 0009_round11.)
--
-- Políticas ADITIVAS (Postgres combina permissivas com OR): "dono OU admin"
-- sem afrouxar o isolamento entre usuários comuns. Idempotente (drop if exists)
-- para poder reaplicar com segurança. Admin NÃO acessa mensagens privadas.
-- ════════════════════════════════════════════════════════════════════

-- Detecta se o chamador é admin. SECURITY DEFINER lê `profiles` ignorando o
-- RLS — evita recursão e mantém a checagem confiável (papel vem do banco).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admin lê perfis" on profiles;
create policy "admin lê perfis" on profiles
  for select using (public.is_admin());

drop policy if exists "admin gerencia imóveis" on properties;
create policy "admin gerencia imóveis" on properties
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin gerencia checklists" on qualification_checklists;
create policy "admin gerencia checklists" on qualification_checklists
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin lê leads" on leads;
create policy "admin lê leads" on leads
  for select using (public.is_admin());

drop policy if exists "admin lê assinaturas" on subscriptions;
create policy "admin lê assinaturas" on subscriptions
  for select using (public.is_admin());

drop policy if exists "admin lê contas de pagamento" on payment_accounts;
create policy "admin lê contas de pagamento" on payment_accounts
  for select using (public.is_admin());

drop policy if exists "admin lê contratos" on contracts;
create policy "admin lê contratos" on contracts
  for select using (public.is_admin());

drop policy if exists "admin lê garantias" on guarantees;
create policy "admin lê garantias" on guarantees
  for select using (public.is_admin());

drop policy if exists "admin lê cotações de seguro" on insurance_quotes;
create policy "admin lê cotações de seguro" on insurance_quotes
  for select using (public.is_admin());

drop policy if exists "admin lê transações" on transactions;
create policy "admin lê transações" on transactions
  for select using (public.is_admin());

drop policy if exists "admin lê verificações" on tenant_verifications;
create policy "admin lê verificações" on tenant_verifications
  for select using (public.is_admin());

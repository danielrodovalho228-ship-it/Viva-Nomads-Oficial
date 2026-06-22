-- ════════════════════════════════════════════════════════════════════
-- Acesso real (Fase 7) — políticas de ADMIN por papel.
--
-- O RLS de 0001 isola dono/inquilino corretamente, mas não havia caminho
-- para o ADMIN da plataforma. Estas políticas são ADITIVAS: o Postgres
-- combina políticas permissivas com OR, então "dono OU admin" passa a valer
-- sem afrouxar o isolamento existente entre usuários comuns.
--
-- Privacidade: o admin NÃO recebe acesso a mensagens privadas (chat) — apenas
-- aos dados operacionais necessários para gestão (imóveis, checklists, leads,
-- assinaturas, financeiro, verificações).
-- ════════════════════════════════════════════════════════════════════

-- Detecta se o chamador é admin. SECURITY DEFINER lê `profiles` ignorando o
-- RLS — evita recursão (uma policy de profiles consultando profiles) e mantém
-- a checagem confiável (papel vem do banco, não do user_metadata editável).
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

-- ── Leitura/gestão do admin (aditiva às policies de dono/inquilino) ──

-- Perfis: admin lê todos (gestão de usuários).
create policy "admin lê perfis" on profiles
  for select using (public.is_admin());

-- Imóveis: admin gerencia todos (moderação/gestão).
create policy "admin gerencia imóveis" on properties
  for all using (public.is_admin()) with check (public.is_admin());

-- Checklists de qualificação: admin gerencia (aprovar/recusar — reviewChecklist).
create policy "admin gerencia checklists" on qualification_checklists
  for all using (public.is_admin()) with check (public.is_admin());

-- Leads: admin lê todos.
create policy "admin lê leads" on leads
  for select using (public.is_admin());

-- Assinaturas: admin lê todas (financeiro/comissões).
create policy "admin lê assinaturas" on subscriptions
  for select using (public.is_admin());

-- Contas de pagamento: admin lê (operação de split/repasse).
create policy "admin lê contas de pagamento" on payment_accounts
  for select using (public.is_admin());

-- Contratos: admin lê todos.
create policy "admin lê contratos" on contracts
  for select using (public.is_admin());

-- Garantias: admin lê todas.
create policy "admin lê garantias" on guarantees
  for select using (public.is_admin());

-- Cotações de seguro: admin lê todas.
create policy "admin lê cotações de seguro" on insurance_quotes
  for select using (public.is_admin());

-- Transações: admin lê todas (financeiro).
create policy "admin lê transações" on transactions
  for select using (public.is_admin());

-- Verificações de inquilino: admin lê todas (suporte/auditoria).
create policy "admin lê verificações" on tenant_verifications
  for select using (public.is_admin());

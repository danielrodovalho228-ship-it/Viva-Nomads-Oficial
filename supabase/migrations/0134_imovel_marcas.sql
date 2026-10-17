-- 0134 — MARCAS "VISTO" E "VOCÊ JÁ CONTATOU" (ordem 8302024d, pacote Próximo do FF 1/3). Idempotente.
--   • public.imovel_marcas: uma linha por (usuário, imóvel) com visto_em e contatado_em.
--   • RLS: cada usuário lê/grava SÓ as próprias marcas. Sem dado pessoal além do id do usuário.
-- Rollback: supabase/producao/rollback/0134_rollback.sql.
create table if not exists public.imovel_marcas (
  user_id uuid not null references auth.users(id) on delete cascade,
  imovel_id uuid not null references public.properties(id) on delete cascade,
  visto_em timestamptz,
  contatado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, imovel_id)
);

alter table public.imovel_marcas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'imovel_marcas' and policyname = 'marcas: ler as proprias') then
    create policy "marcas: ler as proprias" on public.imovel_marcas
      for select to authenticated using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'imovel_marcas' and policyname = 'marcas: criar as proprias') then
    create policy "marcas: criar as proprias" on public.imovel_marcas
      for insert to authenticated with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'imovel_marcas' and policyname = 'marcas: atualizar as proprias') then
    create policy "marcas: atualizar as proprias" on public.imovel_marcas
      for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end;
$$;

revoke all on public.imovel_marcas from anon;
grant select, insert, update on public.imovel_marcas to authenticated;
create index if not exists imovel_marcas_imovel_idx on public.imovel_marcas (imovel_id);

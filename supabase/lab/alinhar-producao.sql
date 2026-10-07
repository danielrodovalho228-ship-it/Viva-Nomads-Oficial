-- LABORATÓRIO — roda DEPOIS das migrações, só no Supabase local de teste.
-- Deixa o banco do laboratório igual ao de produção nos pontos em que
-- produção diverge do repositório (conferido em 07/10/2026 comparando
-- colunas, funções, gatilhos e políticas):
--   1. profiles.role é TEXT em produção (no repositório é o enum user_role);
--   2. produção tem 4 políticas a mais — cópias das que já existem, com a
--      mesma regra (não abrem nada a mais).
-- Nunca rodar em produção.

do $$ begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') <> 'text' then
    alter table public.profiles alter column role type text using role::text;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garantias' and policyname = 'catalogo de garantias e publico') then
    create policy "catalogo de garantias e publico" on public.garantias for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'servicos_adicionais' and policyname = 'catalogo de servicos e publico') then
    create policy "catalogo de servicos e publico" on public.servicos_adicionais for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can view own profile') then
    create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can update own profile') then
    create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
  end if;
end $$;

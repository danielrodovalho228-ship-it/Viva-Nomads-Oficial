-- LABORATÓRIO — roda DEPOIS das migrações, só no Supabase local de teste.
-- Deixa o banco do laboratório igual ao de produção nos pontos em que
-- produção diverge do repositório (conferido em 07/10/2026 comparando
-- colunas, funções, gatilhos e políticas):
--   1. profiles.role é TEXT em produção (no repositório é o enum user_role);
--   2. produção tem 4 políticas a mais — cópias das que já existem, com a
--      mesma regra (não abrem nada a mais).
-- Nunca rodar em produção.

-- O Postgres não deixa mudar o tipo de uma coluna usada numa política (ex.: emails_teste_admin_le, 0136).
-- Então: anota as políticas que dependem de profiles.role, apaga, muda o tipo e recria com a mesma regra
-- (a comparação com o enum vira comparação com texto, que é o que produção já tem).
do $$
declare
  pol record;
  recriar text[] := '{}';
  roles_txt text;
  comando text;
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') = 'text' then
    return;
  end if;

  for pol in
    select p.polname, c.relname, p.polcmd, p.polpermissive, p.polroles,
           pg_get_expr(p.polqual, p.polrelid) as usando,
           pg_get_expr(p.polwithcheck, p.polrelid) as verificar
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
     where c.relnamespace = 'public'::regnamespace
       and exists (select 1 from pg_depend d   -- exists: a política pode citar a coluna mais de uma vez
                    where d.classid = 'pg_policy'::regclass and d.objid = p.oid
                      and d.refobjid = 'public.profiles'::regclass
                      and d.refobjsubid = (select attnum from pg_attribute
                                            where attrelid = 'public.profiles'::regclass and attname = 'role'))
  loop
    select case when pol.polroles = '{0}'::oid[] then 'public'
                else string_agg(quote_ident(r.rolname), ', ') end
      into roles_txt from pg_roles r where pol.polroles = '{0}'::oid[] or r.oid = any(pol.polroles);
    comando := format('create policy %I on public.%I as %s for %s to %s',
      pol.polname, pol.relname,
      case when pol.polpermissive then 'permissive' else 'restrictive' end,
      case pol.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end,
      coalesce(roles_txt, 'public'));
    if pol.usando is not null then comando := comando || ' using (' || replace(pol.usando, '::user_role', '::text') || ')'; end if;
    if pol.verificar is not null then comando := comando || ' with check (' || replace(pol.verificar, '::user_role', '::text') || ')'; end if;
    recriar := recriar || comando;
    execute format('drop policy %I on public.%I', pol.polname, pol.relname);
  end loop;

  alter table public.profiles alter column role type text using role::text;

  foreach comando in array recriar loop
    execute comando;
  end loop;
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

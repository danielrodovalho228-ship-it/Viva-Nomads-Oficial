-- Viva Nomads — aplicar 0101 (CNPJ único por conta; CPF já era único desde a 0090).
-- Aplicada pela Action "Aplicar migrações em produção" quando o PR é mesclado (o merge é a aprovação).
-- Rollback: supabase/producao/rollback/0101_rollback.sql. Se houver CNPJ repetido, não cria o índice (só avisa).
begin;
set local lock_timeout = '5s';

do $$
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'profiles_cnpj_unico') then
    return;
  end if;
  if exists (select 1 from public.profiles where cnpj is not null group by cnpj having count(*) > 1) then
    raise warning '0101: há CNPJ repetido em profiles; índice profiles_cnpj_unico NÃO criado.';
    return;
  end if;
  create unique index profiles_cnpj_unico on public.profiles (cnpj) where cnpj is not null;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261011000101', '0101_cnpj_unico',
       array['-- conteúdo em supabase/migrations/0101_cnpj_unico.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261011000101');
commit;

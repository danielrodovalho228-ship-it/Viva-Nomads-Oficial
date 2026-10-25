-- Viva Nomads — aplicar 0249 (cartão "Por que estou na cidade"). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0249_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.profiles add column if not exists cidade_periodo_inicio date;
alter table public.profiles add column if not exists cidade_periodo_fim date;
alter table public.profiles add column if not exists cidade_empresa text;
alter table public.profiles add column if not exists cidade_frase text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_cidade_porque_chk') then
    alter table public.profiles add constraint profiles_cidade_porque_chk
      check (
        (cidade_empresa is null or char_length(cidade_empresa) <= 60)
        and (cidade_frase is null or char_length(cidade_frase) <= 140)
        and (cidade_periodo_inicio is null or cidade_periodo_fim is null or cidade_periodo_fim >= cidade_periodo_inicio)
      );
  end if;
end $$;

grant update (cidade_periodo_inicio, cidade_periodo_fim, cidade_empresa, cidade_frase) on public.profiles to authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261025000249', '0249_por_que_na_cidade', array['-- conteúdo em supabase/migrations/0249_por_que_na_cidade.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261025000249');
commit;

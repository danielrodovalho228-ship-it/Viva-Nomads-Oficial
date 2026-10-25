-- Viva Nomads — aplicar 0237 (Meus dados: profiles.data_nascimento). Idempotente. Rollback: supabase/producao/rollback/0237_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.profiles add column if not exists data_nascimento date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_data_nascimento_chk') then
    alter table public.profiles add constraint profiles_data_nascimento_chk
      check (data_nascimento is null or (data_nascimento >= date '1900-01-01' and data_nascimento <= current_date));
  end if;
end $$;
comment on column public.profiles.data_nascimento is
  'Meus dados (perfil-04): data de nascimento informada pela própria pessoa. Opcional; só ela lê e grava.';
grant update (data_nascimento) on public.profiles to authenticated;

-- Cópia do que a tela já tinha salvo em user_metadata: linha a linha, pulando o que não for data válida no intervalo.
do $$
declare
  r record;
  d date;
begin
  for r in
    select p.id, u.raw_user_meta_data ->> 'data_nascimento' as v
      from public.profiles p join auth.users u on u.id = p.id
     where p.data_nascimento is null
       and u.raw_user_meta_data ->> 'data_nascimento' ~ '^\d{4}-\d{2}-\d{2}$'
  loop
    begin
      d := r.v::date;
    exception when others then
      continue;
    end;
    if d between date '1900-01-01' and current_date then
      update public.profiles set data_nascimento = d where id = r.id;
    end if;
  end loop;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261024000237', '0237_data_nascimento',
       array['-- conteúdo em supabase/migrations/0237_data_nascimento.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261024000237');
commit;

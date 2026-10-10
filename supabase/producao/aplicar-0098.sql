-- Aplica a 0098 (taxa_extensao + contratos.tipo_cobranca). Idempotente. Conteúdo: supabase/migrations/0098_cobranca_extensao.sql
begin;
insert into public.config_cobranca (chave, valor) values ('taxa_extensao', '6')
on conflict (chave) do nothing;

alter table public.contratos add column if not exists tipo_cobranca text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contratos_tipo_cobranca_check') then
    alter table public.contratos add constraint contratos_tipo_cobranca_check
      check (tipo_cobranca is null or tipo_cobranca in ('novo', 'extensao')) not valid;
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261010000098', '0098_cobranca_extensao',
       array['-- conteúdo em supabase/migrations/0098_cobranca_extensao.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261010000098');
commit;

-- Viva Nomads — aplicar 0099 (regra única de 12%: config taxa_comissao/taxa_renovacao, um degrau só, contratos.tipo_cobranca).
-- Aplicada pela Action "Aplicar migrações em produção" quando o PR é mesclado (o merge é a aprovação).
-- Rollback: supabase/producao/rollback/0099_rollback.sql. Depende da 0096 (config_cobranca, faixas_comissao).
begin;
set local lock_timeout = '5s';

insert into public.config_cobranca (chave, valor) values
  ('taxa_comissao', '12'),
  ('taxa_renovacao', '12')
on conflict (chave) do nothing;

-- Remove só os degraus por volume; o de 1 imóvel vira "sem teto, 12%".
delete from public.faixas_comissao where min_imoveis > 1;
update public.faixas_comissao set max_imoveis = null, taxa = 0.12 where min_imoveis = 1;
insert into public.faixas_comissao (min_imoveis, max_imoveis, taxa) values (1, null, 0.12)
on conflict (min_imoveis) do nothing;

alter table public.contratos add column if not exists tipo_cobranca text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contratos_tipo_cobranca_check') then
    alter table public.contratos add constraint contratos_tipo_cobranca_check
      check (tipo_cobranca is null or tipo_cobranca in ('novo', 'renovacao')) not valid;
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261010000099', '0099_regra_unica_12',
       array['-- conteúdo em supabase/migrations/0099_regra_unica_12.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261010000099');
commit;

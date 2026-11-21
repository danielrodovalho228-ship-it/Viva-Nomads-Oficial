-- Viva Nomads — aplicar 0348 (E1072: um bloco pode ser pago em partes — coluna `parte` em pagamentos_bloco e o índice
-- único "um registro por bloco e parte" no lugar de "um por bloco"). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. NÃO regrava valor de nenhuma linha: as existentes ficam com parte = 1.
-- Rollback: supabase/producao/rollback/0348_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'pagamentos_bloco' and column_name = 'parte'
  ) then
    alter table public.pagamentos_bloco add column parte integer not null default 1;
  end if;
end;
$$;

do $c$ begin
  alter table public.pagamentos_bloco add constraint pagamentos_bloco_parte_valida check (parte >= 1);
exception when duplicate_object then null; end $c$;

comment on column public.pagamentos_bloco.parte is 'E1072: número do registro dentro do bloco (1 = o primeiro; 2 em diante = registros complementares do mesmo bloco).';

-- O índice novo entra ANTES de o antigo sair: não há instante sem a regra de não repetição.
create unique index if not exists pagamentos_bloco_uma_parte_por_bloco
  on public.pagamentos_bloco (bloco_id, parte) where tipo = 'aluguel' and anulado_em is null;
drop index if exists public.pagamentos_bloco_um_valor_mensal;

insert into supabase_migrations.schema_migrations (version, name)
select '20261121000348', '0348_pagamentos_bloco_partes_e1072'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261121000348');
commit;

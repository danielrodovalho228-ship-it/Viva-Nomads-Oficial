-- Viva Nomads — aplicar 0366 (E1223: o credenciamento UBE-002 passa ao próximo UDI do contador, só em_teste, sem pedidos
-- e com o número novo livre; senão, nada muda e fica um raise notice). Idempotente: reaplicada, não acha mais UBE-002.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0366_rollback.sql.
begin;
set local lock_timeout = '5s';

-- O registo das trocas de número (só o servidor lê): é por ele que o rollback sabe que credenciamento devolver.
create table if not exists public.avaliadores_numero_trocas (
  id uuid primary key default gen_random_uuid(),
  credenciamento_id uuid not null,
  numero_antes text not null,
  numero_depois text not null,
  migracao text not null,
  trocado_em timestamptz not null default now(),
  unique (migracao, numero_antes)
);
alter table public.avaliadores_numero_trocas enable row level security;
revoke all on public.avaliadores_numero_trocas from public, anon, authenticated;

do $troca$
declare
  v_cred uuid;
  v_status text;
  v_pedidos integer;
  v_seguinte integer;
  v_novo text;
begin
  select id, status into v_cred, v_status from public.avaliadores_credenciamento where numero_credenciado = 'UBE-002';
  if v_cred is null then
    raise notice '0366: não há credenciamento UBE-002; nada muda.';
    return;
  end if;
  if v_status is distinct from 'em_teste' then
    raise notice '0366: o UBE-002 está %, não em_teste; nada muda.', v_status;
    return;
  end if;
  select count(*) into v_pedidos from public.vistoria_pedidos where avaliador_id = v_cred;
  if v_pedidos > 0 then
    raise notice '0366: o UBE-002 tem % pedido(s) de vistoria; nada muda.', v_pedidos;
    return;
  end if;
  -- O próximo UDI do contador (avaliadores_contador: o mesmo que proximo_numero_avaliador('UDI') daria).
  select coalesce((select ultimo from public.avaliadores_contador where sigla = 'UDI' for update), 0) + 1 into v_seguinte;
  v_novo := 'UDI-' || lpad(v_seguinte::text, 3, '0');
  if exists (select 1 from public.avaliadores_credenciamento where numero_credenciado = v_novo)
     or exists (select 1 from public.avaliadores_perfil_publico where numero = v_novo) then
    raise notice '0366: o número % já está em uso; nada muda.', v_novo;
    return;
  end if;
  insert into public.avaliadores_contador as c (sigla, ultimo) values ('UDI', v_seguinte)
    on conflict (sigla) do update set ultimo = excluded.ultimo;
  -- Só o número muda: o status, a cidade e o perfil ficam como estão.
  update public.avaliadores_credenciamento set numero_credenciado = v_novo where id = v_cred;
  insert into public.avaliadores_numero_trocas (credenciamento_id, numero_antes, numero_depois, migracao)
  values (v_cred, 'UBE-002', v_novo, '0366');
  raise notice '0366: UBE-002 passou a %.', v_novo;
end;
$troca$;

insert into supabase_migrations.schema_migrations (version, name)
select '20261126000366', '0366_avaliador_ube002_para_udi_e1223'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261126000366');
commit;

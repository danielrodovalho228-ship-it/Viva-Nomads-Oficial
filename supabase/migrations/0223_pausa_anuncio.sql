-- 0223 — 64-B: pausar e reativar anúncio pelo dono. O MOTIVO da pausa decide quem reativa: só o que o dono pausou
-- (motivo 'dono') volta pelas mãos dele; a pausa da Viva (padrão mínimo, câmera, admin, avaliação) e a da conta pausada
-- só voltam pelo caminho de cada uma. Idempotente.

-- ── 1. Motivo e data da pausa ────────────────────────────────────────────────────────────────────────────────────
alter table public.properties add column if not exists pausa_motivo text;
alter table public.properties add column if not exists pausado_em timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_pausa_motivo_chk') then
    alter table public.properties add constraint properties_pausa_motivo_chk
      check (pausa_motivo is null or pausa_motivo in ('dono', 'conforto', 'camera', 'admin', 'avaliacao', 'conta'));
  end if;
end $$;
-- O dono lê (Meus imóveis mostra o motivo); quem grava é o servidor, depois de conferir o dono.
grant select (pausa_motivo, pausado_em) on public.properties to authenticated;
revoke update (pausa_motivo, pausado_em) on public.properties from anon, authenticated;

-- ── 2. Os pausados que já existem: motivo inferido ────────────────────────────────────────────────────────────────
update public.properties p
   set pausa_motivo = case
         when p.pausado_pela_conta then 'conta'
         when exists (select 1 from public.conforto_adequacao c where c.property_id = p.id and c.pausado_em is not null) then 'conforto'
         when exists (select 1 from public.vistoria_bloqueios v where v.property_id = p.id and v.pausou and v.resolvido_em is null) then 'avaliacao'
         else 'admin'
       end,
       pausado_em = coalesce(p.pausado_em, now())
 where p.status = 'paused' and p.pausa_motivo is null;

-- ── 3. Coerência: pausado sempre tem motivo; publicado nunca tem ──────────────────────────────────────────────────
-- Quem pausa sem dizer o motivo (ex.: um caminho antigo) fica como pausa da Viva ('admin'), nunca como do dono.
create or replace function public.properties_pausa_coerente() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status::text = 'paused' then
    if old.status::text is distinct from 'paused' then
      new.pausa_motivo := coalesce(new.pausa_motivo, 'admin');
      new.pausado_em := coalesce(new.pausado_em, now());
    end if;
  elsif new.pausa_motivo is not null or new.pausado_em is not null then
    new.pausa_motivo := null;
    new.pausado_em := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_properties_pausa_coerente on public.properties;
create trigger trg_properties_pausa_coerente before update of status on public.properties
  for each row execute function public.properties_pausa_coerente();

-- ── 4. O dono só reativa o que ELE pausou ─────────────────────────────────────────────────────────────────────────
create or replace function public.properties_reativar_so_dono() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.status::text = 'paused' and new.status::text = 'active'
     and current_user = 'authenticated' and pg_trigger_depth() <= 1
     and coalesce(old.pausa_motivo, 'admin') <> 'dono' then
    raise exception 'Este anúncio foi pausado pela Viva e volta pelo caminho indicado em Meus imóveis.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_properties_reativar_so_dono on public.properties;
create trigger trg_properties_reativar_so_dono before update of status on public.properties
  for each row execute function public.properties_reativar_so_dono();

-- ── 5. O motivo é do servidor ──────────────────────────────────────────────────────────────────────────────────────
-- A permissão de update da tabela inteira vem do padrão do Supabase (o revoke da coluna não basta): este gatilho recusa
-- quem tenta gravar o motivo direto pela sessão. Só dispara quando o próprio comando cita as colunas — a limpeza feita
-- pelo gatilho de coerência (ao reativar) segue valendo.
create or replace function public.properties_pausa_so_servidor() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and pg_trigger_depth() <= 1
     and (new.pausa_motivo is distinct from old.pausa_motivo or new.pausado_em is distinct from old.pausado_em) then
    raise exception 'O motivo da pausa é gravado pela Viva.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_properties_pausa_so_servidor on public.properties;
create trigger trg_properties_pausa_so_servidor before update of pausa_motivo, pausado_em on public.properties
  for each row execute function public.properties_pausa_so_servidor();

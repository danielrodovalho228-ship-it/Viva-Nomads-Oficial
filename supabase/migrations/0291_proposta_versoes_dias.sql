-- 0291 — E562 (E-DIAS): a estadia da proposta em DIAS exatos (30 a 180). proposta_versoes ganha `dias` (com check) e
-- `limpezas_pacote` (ajuste do dono no pacote de limpezas; vazio = round(limpezas por mês × dias ÷ 30)). `meses` vira
-- referência derivada (ceil(dias ÷ 30)). Backfill: dias = meses × 30 — as propostas antigas ficam com o mesmo total.
-- A regra do preço fica em src/lib/estadia-em-dias.ts. Idempotente. Desfazer: supabase/producao/rollback/0291_rollback.sql.
-- 1) Os dias exatos da estadia e o ajuste do pacote de limpezas.
alter table public.proposta_versoes add column if not exists dias integer;
alter table public.proposta_versoes add column if not exists limpezas_pacote integer;

-- 2) Backfill: as versões antigas eram em meses de 30 dias (total, taxa e período ficam iguais).
update public.proposta_versoes set dias = meses * 30 where dias is null;

-- 3) meses vira referência derivada dos dias (ceil(dias ÷ 30)); quem ainda grava só meses ganha dias = meses × 30.
create or replace function public.proposta_versoes_dias()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'UPDATE' and new.dias is not distinct from old.dias and new.meses is distinct from old.meses then
    new.dias := new.meses * 30;
  elsif new.dias is null then
    new.dias := new.meses * 30;
  end if;
  new.meses := ceil(new.dias / 30.0)::integer;
  return new;
end;
$fn$;

drop trigger if exists proposta_versoes_dias on public.proposta_versoes;
create trigger proposta_versoes_dias
  before insert or update on public.proposta_versoes
  for each row execute function public.proposta_versoes_dias();

-- 4) 30 a 180 dias, meses coerente com os dias, pacote de limpezas entre 0 e 48.
alter table public.proposta_versoes alter column dias set not null;
alter table public.proposta_versoes drop constraint if exists proposta_versoes_dias_validos;
alter table public.proposta_versoes add constraint proposta_versoes_dias_validos
  check (dias between 30 and 180 and meses = ceil(dias / 30.0)::integer);
alter table public.proposta_versoes drop constraint if exists proposta_versoes_limpezas_pacote_valido;
alter table public.proposta_versoes add constraint proposta_versoes_limpezas_pacote_valido
  check (limpezas_pacote is null or limpezas_pacote between 0 and 48);

-- 5) Mesma leitura das outras colunas: as duas partes leem (RLS da 0153); só o servidor grava.
grant select (dias, limpezas_pacote) on public.proposta_versoes to authenticated;
grant select, insert, update (dias, limpezas_pacote) on public.proposta_versoes to service_role;

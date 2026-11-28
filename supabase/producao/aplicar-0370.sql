-- Viva Nomads — aplicar 0370 (E1240: a hora de saída das instruções de entrada). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Não grava nem regrava linha nenhuma; não dá permissão a ninguém.
-- Rollback: supabase/producao/rollback/0370_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.contratos_checkin add column if not exists horario_saida text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contratos_checkin_horario_saida_fmt' and conrelid = 'public.contratos_checkin'::regclass) then
    alter table public.contratos_checkin add constraint contratos_checkin_horario_saida_fmt check (horario_saida is null or horario_saida ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;
end $$;
comment on column public.contratos_checkin.horario_saida is 'E1240: a hora de saída das instruções (HH:MM), opcional; move a âncora da conferência de saída. Vazia = 23:59 do dia da saída.';

commit;

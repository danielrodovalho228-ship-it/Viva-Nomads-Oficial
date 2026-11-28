-- 0370 (E1240, ESPEC-E1240 v5, secção 1; ORDEM-DUET 1324 do Gerente, 28/11/2026): a hora de SAÍDA das instruções de
-- entrada ("Horário de saída (opcional)"), em contratos_checkin.horario_saida. Move a âncora da conferência de saída
-- (src/lib/conferencia.ts, ancoraConferencia); sem ela, a âncora fica nas 23:59 do dia da saída, como hoje.
-- A regra do formato é a da hora de entrada (0127): vazia, ou HH:MM de 00:00 a 23:59 — com nome próprio, para o
-- rollback a tirar. O que NÃO faz: não grava nem regrava linha nenhuma (as que existem ficam com a coluna vazia), não dá
-- permissão a ninguém (a tabela é só do servidor, 0127) e não tem valor por omissão. Sem dado pessoal.
-- Rollback: supabase/producao/rollback/0370_rollback.sql (com alguma hora de saída gravada, falha sem mudar nada).
alter table public.contratos_checkin add column if not exists horario_saida text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contratos_checkin_horario_saida_fmt' and conrelid = 'public.contratos_checkin'::regclass) then
    alter table public.contratos_checkin add constraint contratos_checkin_horario_saida_fmt check (horario_saida is null or horario_saida ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;
end $$;
comment on column public.contratos_checkin.horario_saida is 'E1240: a hora de saída das instruções (HH:MM), opcional; move a âncora da conferência de saída. Vazia = 23:59 do dia da saída.';

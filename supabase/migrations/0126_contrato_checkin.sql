-- Viva Nomads — 0126: check-in garantido (ordem 404cd213, item 2).
-- Instruções de entrada que o proprietário informa no contrato: horário, como pegar a chave/acesso e telefone de
-- plantão. Escrita e leitura só pelo servidor (service role), depois de conferir a parte do contrato; o
-- inquilino só as vê com as duas assinaturas. Rollback: supabase/producao/rollback/0126_rollback.sql.
alter table public.contratos
  add column if not exists checkin_horario text,
  add column if not exists checkin_instrucoes text,
  add column if not exists checkin_plantao text,
  add column if not exists checkin_atualizado_em timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contratos_checkin_horario_fmt') then
    alter table public.contratos add constraint contratos_checkin_horario_fmt
      check (checkin_horario is null or checkin_horario ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contratos_checkin_instrucoes_len') then
    alter table public.contratos add constraint contratos_checkin_instrucoes_len
      check (checkin_instrucoes is null or char_length(checkin_instrucoes) <= 600);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contratos_checkin_plantao_fmt') then
    alter table public.contratos add constraint contratos_checkin_plantao_fmt
      check (checkin_plantao is null or checkin_plantao ~ '^[0-9]{10,13}$');
  end if;
end $$;

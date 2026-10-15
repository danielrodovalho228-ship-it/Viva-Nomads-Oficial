-- Viva Nomads — aplicar 0126 (check-in garantido: instruções de entrada no contrato). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0126_rollback.sql.
begin;
set local lock_timeout = '5s';

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

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261015000126', '0126_contrato_checkin',
       array['-- conteúdo em supabase/migrations/0126_contrato_checkin.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261015000126');
commit;

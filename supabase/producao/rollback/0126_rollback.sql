-- Rollback da 0126: remove as instruções de entrada do contrato (os dados digitados se perdem).
begin;
alter table public.contratos
  drop constraint if exists contratos_checkin_horario_fmt,
  drop constraint if exists contratos_checkin_instrucoes_len,
  drop constraint if exists contratos_checkin_plantao_fmt,
  drop column if exists checkin_horario,
  drop column if exists checkin_instrucoes,
  drop column if exists checkin_plantao,
  drop column if exists checkin_atualizado_em;
delete from supabase_migrations.schema_migrations where version = '20261015000126';
commit;

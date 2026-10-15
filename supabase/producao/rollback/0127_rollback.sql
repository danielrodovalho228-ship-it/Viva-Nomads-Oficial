-- Rollback da 0127: devolve as instruções de entrada às colunas de public.contratos (0126) e remove a tabela.
-- Atenção: volta a expor o telefone de plantão ao inquilino pela política "contrato visível às partes".
begin;
alter table public.contratos
  add column if not exists checkin_horario text,
  add column if not exists checkin_instrucoes text,
  add column if not exists checkin_plantao text,
  add column if not exists checkin_atualizado_em timestamptz;
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'contratos_checkin') then
    update public.contratos c
       set checkin_horario = k.horario, checkin_instrucoes = k.instrucoes, checkin_plantao = k.plantao, checkin_atualizado_em = k.atualizado_em
      from public.contratos_checkin k where k.contrato_id = c.id;
  end if;
end $$;
drop table if exists public.contratos_checkin;
delete from supabase_migrations.schema_migrations where version = '20261015000127';
commit;

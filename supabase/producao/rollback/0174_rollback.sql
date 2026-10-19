-- Rollback da 0174: tira a regra de sobreposição, o gatilho e a coluna; devolve o status dos contratos de teste encerrados.
begin;
alter table public.contratos drop constraint if exists contratos_periodo_sem_sobreposicao;
drop trigger if exists contrato_blocos_periodo on public.contrato_blocos;
drop function if exists public.contrato_blocos_atualiza_periodo();
drop function if exists public.contrato_periodo_dos_blocos(uuid);
do $$
begin
  if to_regclass('public._bkp_0174_contratos_encerrados') is not null then
    update public.contratos c set status = b.status, encerrado_em = b.encerrado_em
      from public._bkp_0174_contratos_encerrados b where b.id = c.id;
  end if;
end;
$$;
drop table if exists public._bkp_0174_contratos_encerrados;
alter table public.contratos drop column if exists periodo;
delete from supabase_migrations.schema_migrations where version = '20261019000174';
commit;

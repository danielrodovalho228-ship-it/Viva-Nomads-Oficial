-- Viva Nomads — aplicar 0331 (QA: avaliador de teste UDI-002 ativo, E690). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0331_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_id uuid;
begin
  select a.id into v_id
    from public.avaliadores_credenciamento a
    left join public.parceiros p on p.id = a.parceiro_id
    join public.profiles u on u.id = coalesce(a.user_id, p.user_id)
   where a.numero_credenciado = 'UDI-002'
     and a.status = 'em_teste'
     and u.is_teste
     and exists (
       select 1 from public.vistoria_pedidos v
        where v.avaliador_id = a.id and v.teste and v.status = 'laudo_emitido'
     );
  if v_id is null then
    raise notice '0331: UDI-002 ausente, já decidido, sem conta de teste ou sem avaliação de teste concluída; nada a fazer';
    return;
  end if;
  update public.avaliadores_credenciamento
     set status = 'ativo',
         ativado_em = coalesce(ativado_em, now()),
         decidido_em = now(),
         motivo = 'Massa de teste E690: ativado por migração (conta is_teste), sem decisão de admin.'
   where id = v_id and status = 'em_teste';
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000331', '0331_qa_avaliador_udi002_ativo_e690', array['-- conteúdo em supabase/migrations/0331_qa_avaliador_udi002_ativo_e690.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000331');
commit;

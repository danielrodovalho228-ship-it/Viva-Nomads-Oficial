-- Viva Nomads — desfazer a 0366 (E1223): devolve UBE-002 ao credenciamento que a 0366 trocou, sob as mesmas condições —
-- o status ainda é em_teste, há 0 pedidos de vistoria com ele, e nenhuma linha usa UBE-002. Se alguma falha, não altera
-- nada e avisa por raise notice (e a 0366 fica registada). O contador UDI não volta atrás (o número dado não se reutiliza).
-- Devolvido o número (ou se a 0366 não trocou nada), sai a tabela do registo das trocas, se ficou vazia, e o registo da
-- 0366 em schema_migrations. Nunca roda sozinho.
begin;
set local lock_timeout = '5s';

do $desfaz$
declare
  v_troca record;
  v_status text;
  v_pedidos integer;
begin
  select t.id, t.credenciamento_id, t.numero_depois into v_troca
    from public.avaliadores_numero_trocas t
   where t.migracao = '0366' and t.numero_antes = 'UBE-002';
  if v_troca.id is not null then
    select status into v_status from public.avaliadores_credenciamento
     where id = v_troca.credenciamento_id and numero_credenciado = v_troca.numero_depois;
    if v_status is distinct from 'em_teste' then
      raise notice 'rollback 0366: o credenciamento % não está em_teste com esse número (%); nada muda.', v_troca.numero_depois, coalesce(v_status, 'sem linha');
      return;
    end if;
    select count(*) into v_pedidos from public.vistoria_pedidos where avaliador_id = v_troca.credenciamento_id;
    if v_pedidos > 0 then
      raise notice 'rollback 0366: o % já tem % pedido(s) de vistoria; nada muda.', v_troca.numero_depois, v_pedidos;
      return;
    end if;
    if exists (select 1 from public.avaliadores_credenciamento where numero_credenciado = 'UBE-002')
       or exists (select 1 from public.avaliadores_perfil_publico where numero = 'UBE-002') then
      raise notice 'rollback 0366: UBE-002 já está em uso; nada muda.';
      return;
    end if;
    update public.avaliadores_credenciamento set numero_credenciado = 'UBE-002' where id = v_troca.credenciamento_id;
    delete from public.avaliadores_numero_trocas where id = v_troca.id;
    raise notice 'rollback 0366: % voltou a UBE-002.', v_troca.numero_depois;
  else
    raise notice 'rollback 0366: a 0366 não trocou número nenhum.';
  end if;
  -- Nada por devolver: sai a tabela do registo das trocas (se vazia) e o registo da 0366.
  if not exists (select 1 from public.avaliadores_numero_trocas) then
    drop table public.avaliadores_numero_trocas;
  end if;
  delete from supabase_migrations.schema_migrations where version = '20261126000366';
end;
$desfaz$;
commit;

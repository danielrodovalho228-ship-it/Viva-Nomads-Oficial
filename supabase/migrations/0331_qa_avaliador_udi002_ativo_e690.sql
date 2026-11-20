-- E690 (decisão do coordenador, 08/11/2026): massa de teste — o avaliador UDI-002 (conta is_teste) passa de em_teste a ativo,
-- para existir um avaliador ativo exercitável na prova do E682 (escolha → proposta → laudo).
-- Só dado, idempotente. Guardas: a conta do avaliador precisa ser is_teste, o status ainda em_teste e a avaliação de teste
-- concluída (a mesma condição que a tela do admin exige). Não toca em UDI-001, em contas reais nem em chaves.
-- Registro honesto: decidido_por fica vazio (nenhum admin decidiu) e o motivo diz que foi massa de teste.
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

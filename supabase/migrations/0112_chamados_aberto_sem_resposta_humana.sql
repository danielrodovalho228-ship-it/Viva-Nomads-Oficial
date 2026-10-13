-- F22 (ordem d437e6f2): chamado só fica "Aguardando você" depois de resposta de PESSOA da equipe.
-- Os que a Viva deixou assim sozinha voltam para "Aberto". Idempotente.
update public.chamados c
   set status = 'aberto'
 where c.status = 'aguardando_usuario'
   and not exists (
     select 1 from public.chamado_mensagens m
      where m.chamado_id = c.id and m.autor = 'admin' and coalesce(m.interno, false) = false
   );

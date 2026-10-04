-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK da 0053 (p0_seguranca_revokes). Volta ao estado ANTERIOR à 0053
-- (a 0052 continua aplicada).
--
-- ⚠️ Reabre C3/C4 (coleta de contatos pelas RPCs; colunas sensíveis legíveis).
-- Rode tudo de uma vez no SQL Editor (é uma transação).
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- C4b — SELECT de volta na tabela inteira (padrão do Supabase).
grant select on public.properties to anon, authenticated;

-- C3b — execute de volta para authenticated (como nas migrações 0023/0024/0028).
grant execute on function public.owner_notify_contact(uuid)       to authenticated;
grant execute on function public.message_notify_contact(uuid)     to authenticated;
grant execute on function public.pedido_owner_recipients(text)    to authenticated;
grant execute on function public.pedido_inquilino_recipient(uuid) to authenticated;
-- anon: só devolva se a seção 4 do verificar-seguranca.sql rodado ANTES de tudo
-- mostrou "anon" em quem_pode_executar. Nesse caso, descomente:
-- grant execute on function public.owner_notify_contact(uuid)       to anon;
-- grant execute on function public.message_notify_contact(uuid)     to anon;
-- grant execute on function public.pedido_owner_recipients(text)    to anon;
-- grant execute on function public.pedido_inquilino_recipient(uuid) to anon;

-- C4c — devolve o draft_data limpo pela 0053 (só linhas ainda vazias).
update public.properties p
   set draft_data = b.draft_data
  from public._backup_p0_draft_data b
 where b.property_id = p.id and b.migracao = '0053' and p.draft_data is null;
delete from public._backup_p0_draft_data where migracao = '0053';

commit;

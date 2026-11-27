-- E657 (aprovada pelo Daniel em 07/11/2026) — a candidatura REENVIADA guarda a data do reenvio.
-- A candidatura repetida (E581) atualiza período, motivo e pessoas do lead ainda sem resposta, mas `created_at` não muda:
-- enviada em 06/11, a lista mostrava 04/11. Coluna aditiva e anulável; a lista passa a mostrar `reenviada_em ?? created_at`.
-- Só o dado de data (sem dado pessoal novo). O usuário já lê as outras colunas do lead por grant de coluna (0062): libera esta também.
alter table public.leads
  add column if not exists reenviada_em timestamptz;

comment on column public.leads.reenviada_em is 'Quando a candidatura foi reenviada (E581/E657); null = nunca reenviada (vale created_at).';

grant select (reenviada_em) on public.leads to authenticated;

-- Caso conhecido da prova de 07/11 (VN-PD-A65945B6, Lucas × anúncio de teste do Paulo, criada em 04/11): o reenvio de 06/11 21:09 BRT
-- já aconteceu antes da coluna existir. A mensagem que o reenvio postou na conversa (a última do morador ao dono) guarda o instante.
-- Só este lead, só entre contas de TESTE, só se ainda não houver reenvio; nenhum outro lead é tocado.
update public.leads l
   set reenviada_em = (
     select max(m.created_at) from public.messages m
      where m.property_id = l.property_id and m.sender_id = l.tenant_id and m.receiver_id = l.owner_id
        and m.created_at > l.created_at + interval '1 hour')
 where l.id = 'a65945b6-1c11-4e89-95c7-e4a0fde6f616'
   and l.reenviada_em is null
   and exists (select 1 from public.profiles p where p.id = l.tenant_id and p.is_teste is true)
   and exists (select 1 from public.profiles p where p.id = l.owner_id and p.is_teste is true);

-- Viva Nomads — aplicar 0315 (E657: candidatura reenviada guarda reenviada_em). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0315_rollback.sql.
begin;
set local lock_timeout = '5s';

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

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000315', '0315_candidatura_reenviada_em_e657', array['-- conteúdo em supabase/migrations/0315_candidatura_reenviada_em_e657.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000315');

commit;

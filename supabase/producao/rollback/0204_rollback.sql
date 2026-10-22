-- Viva Nomads — rollback da 0204 (Viva rodando automático, Prompt 38). Idempotente.
-- Apaga os vínculos de parceiros dos imóveis, os campos da automação nos pedidos e a marca "precisa de reparo".
-- Pedidos automáticos já criados ficam como pedidos manuais (a origem volta a 'manual' antes de soltar a regra).
begin;
set local lock_timeout = '5s';
drop policy if exists parceiro_pedidos_le on public.parceiro_pedidos;
create policy parceiro_pedidos_le on public.parceiro_pedidos for select to authenticated
  using (public.parceiro_pedido_parte(id) or public.is_admin());
alter table public.parceiro_pedidos drop constraint if exists parceiro_pedidos_automatico_com_chave;
alter table public.parceiro_pedidos drop constraint if exists parceiro_pedidos_gatilho_check;
alter table public.parceiro_pedidos drop constraint if exists parceiro_pedidos_janela_check;
drop index if exists public.parceiro_pedidos_chave_automacao;
drop index if exists public.parceiro_pedidos_contrato_idx;
drop index if exists public.parceiro_pedidos_vinculo_idx;
update public.parceiro_pedidos set origem = 'manual' where origem = 'automatico';
alter table public.parceiro_pedidos
  drop column if exists chave_automacao,
  drop column if exists gatilho,
  drop column if exists vinculo_id,
  drop column if exists contrato_id,
  drop column if exists janela_inicio,
  drop column if exists janela_fim,
  drop column if exists aguardando_dono,
  drop column if exists enviado_em,
  drop column if exists sem_resposta_avisado_em;
drop table if exists public.imovel_parceiros;
alter table public.conferencia_itens drop column if exists precisa_reparo;
delete from supabase_migrations.schema_migrations where version = '20261022000204';
commit;

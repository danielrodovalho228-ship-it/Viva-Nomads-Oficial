-- Viva Nomads — rollback da 0225 (tipo de entrada, mensagem para quem pede, o que considerar, convidados — 61-B).
-- Idempotente. Apaga os convites (os convidados perdem o acesso na hora) e os campos novos do anúncio.
begin;
set local lock_timeout = '5s';
delete from public.contrato_eventos where tipo in ('convidado_adicionado', 'convidado_removido', 'convidados_apagados');
alter table public.contrato_eventos drop constraint if exists contrato_eventos_tipo_check;
alter table public.contrato_eventos add constraint contrato_eventos_tipo_check check (tipo in (
  'aditivo_proposto', 'aditivo_aceito', 'aditivo_recusado', 'aditivo_expirado', 'estadia_remarcada',
  'encerramento_pedido', 'contrato_encerrado', 'instrucoes_liberadas', 'ocupantes_apagados'
));
drop trigger if exists estadia_convidados_teto on public.estadia_convidados;
drop function if exists public.estadia_convidados_teto();
drop table if exists public.estadia_convidados;
drop function if exists public.eh_convidado_do_contrato(uuid);
alter table public.properties drop constraint if exists properties_tipo_entrada_chk;
alter table public.properties drop constraint if exists properties_mensagem_para_pedido_chk;
alter table public.properties drop constraint if exists properties_considerar_antes_chk;
alter table public.properties drop constraint if exists properties_considerar_antes_texto_chk;
alter table public.properties drop column if exists tipo_entrada;
alter table public.properties drop column if exists mensagem_para_pedido;
alter table public.properties drop column if exists considerar_antes;
alter table public.properties drop column if exists considerar_antes_texto;
delete from supabase_migrations.schema_migrations where version = '20261023000225';
commit;

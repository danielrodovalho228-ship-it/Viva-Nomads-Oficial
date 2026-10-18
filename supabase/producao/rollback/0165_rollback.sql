-- Rollback da 0165: volta a visita a só "por vídeo" (pedidos presenciais e remarcações são apagados antes).
begin;
delete from public.visitas_video where modalidade = 'presencial';
update public.visitas_video set status = 'cancelado' where status = 'remarcar';
drop index if exists public.visitas_video_um_aberto_modalidade;
create unique index if not exists visitas_video_um_aberto on public.visitas_video (tenant_id, property_id)
  where status in ('pedido', 'confirmado');
alter table public.visitas_video drop constraint if exists visitas_video_status_check;
alter table public.visitas_video add constraint visitas_video_status_check check (status in ('pedido', 'confirmado', 'feito', 'cancelado'));
alter table public.visitas_video drop constraint if exists visitas_video_modalidade_check;
alter table public.visitas_video drop constraint if exists visitas_video_motivo_recusa_check;
alter table public.visitas_video drop column if exists modalidade;
alter table public.visitas_video drop column if exists horario_proposto;
alter table public.visitas_video drop column if exists motivo_recusa;
delete from supabase_migrations.schema_migrations where version = '20261018000165';
commit;

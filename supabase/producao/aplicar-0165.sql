-- Viva Nomads — aplicar 0165 (visita presencial na plataforma: modalidade, remarcar, motivo da recusa). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0165_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.visitas_video add column if not exists modalidade text not null default 'video';
alter table public.visitas_video add column if not exists horario_proposto timestamptz;
alter table public.visitas_video add column if not exists motivo_recusa text;

alter table public.visitas_video drop constraint if exists visitas_video_modalidade_check;
alter table public.visitas_video add constraint visitas_video_modalidade_check check (modalidade in ('video', 'presencial'));
alter table public.visitas_video drop constraint if exists visitas_video_motivo_recusa_check;
alter table public.visitas_video add constraint visitas_video_motivo_recusa_check check (motivo_recusa is null or char_length(motivo_recusa) <= 200);
alter table public.visitas_video drop constraint if exists visitas_video_status_check;
alter table public.visitas_video add constraint visitas_video_status_check
  check (status in ('pedido', 'confirmado', 'remarcar', 'feito', 'cancelado'));

-- Um pedido em aberto por morador, imóvel e modalidade (vídeo e presencial podem coexistir).
drop index if exists public.visitas_video_um_aberto;
create unique index if not exists visitas_video_um_aberto_modalidade on public.visitas_video (tenant_id, property_id, modalidade)
  where status in ('pedido', 'confirmado', 'remarcar');

-- Leitura por coluna (tenant_id continua de fora: o dono nunca vê a identidade do morador antes do aceite).
grant select (modalidade, horario_proposto, motivo_recusa) on public.visitas_video to authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261018000165', '0165_visitas_presencial',
       array['-- conteúdo em supabase/migrations/0165_visitas_presencial.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261018000165');
commit;

-- Viva Nomads — rollback da 0244: tira a fila de revisão das fotos de perfil, a função de envio e o contexto 'perfil'
-- dos chamados. Idempotente. Os avatares atuais (profiles.avatar_url) e os arquivos ficam; fotos já removidas pela fila
-- continuam removidas. Os chamados abertos pela foto de alguém ficam, só sem o vínculo (contexto vira null).
begin;
set local lock_timeout = '5s';
drop function if exists public.foto_perfil_enviada(uuid, text);
drop table if exists public.fotos_perfil_revisao;
update public.chamados set contexto_tipo = null, contexto_id = null where contexto_tipo = 'perfil';
alter table public.chamados drop constraint if exists chamados_contexto_tipo_check;
alter table public.chamados add constraint chamados_contexto_tipo_check check (contexto_tipo in ('pedido', 'contrato', 'anuncio', 'manutencao', 'parceiro'));
delete from supabase_migrations.schema_migrations where version = '20261024000244';
commit;

-- Rollback da 0245: os dois imóveis de teste voltam a pausados (pausa do dono) e sem pacote de limpeza.
begin;
update public.properties
   set status = 'paused', pausa_motivo = 'dono', limpeza_estadia = null
 where id in ('ddf86c66-a214-463d-8563-66a5204010b5', '9f18c108-ce4e-4b2c-b731-606ade99370d')
   and owner_id in (select id from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste);
delete from supabase_migrations.schema_migrations where version = '20261024000245';
commit;

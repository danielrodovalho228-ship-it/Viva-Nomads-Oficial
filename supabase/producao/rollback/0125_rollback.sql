-- Rollback da 0125: tira a leitura pública das colunas (o anúncio volta a abrir sem regras de pets/câmeras/acesso).
begin;
revoke select (pets_regras, sem_cameras_interior, cameras_externas, tipo_acesso, senha_trocada_estadia)
  on public.properties from anon, authenticated;
delete from supabase_migrations.schema_migrations where version = '20261014000125';
commit;

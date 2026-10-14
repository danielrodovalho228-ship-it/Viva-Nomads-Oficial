-- Viva Nomads — 0116: privacidade e acesso do imóvel (ordem f92bc582).
-- Declaração do anunciante: sem câmeras/dispositivos que gravem imagem ou som
-- dentro do imóvel; câmeras externas (onde); tipo de acesso e troca de senha.
alter table public.properties
  add column if not exists sem_cameras_interior boolean not null default false,
  add column if not exists cameras_externas text,
  add column if not exists tipo_acesso text,
  add column if not exists senha_trocada_estadia boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_tipo_acesso_check') then
    alter table public.properties add constraint properties_tipo_acesso_check
      check (tipo_acesso is null or tipo_acesso in ('chave','fechadura_senha','cofre'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_cameras_externas_len') then
    alter table public.properties add constraint properties_cameras_externas_len
      check (cameras_externas is null or char_length(cameras_externas) <= 200);
  end if;
end $$;

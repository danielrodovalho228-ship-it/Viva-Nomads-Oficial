-- Rollback da 0179: tira as políticas, o bucket (se vazio) e as colunas de foto do pet.
-- Atenção: apagar as colunas perde os caminhos das fotos; os arquivos precisam estar apagados do bucket antes.
begin;
drop policy if exists "pets-fotos: dono le" on storage.objects;
drop policy if exists "pets-fotos: dono envia" on storage.objects;
drop policy if exists "pets-fotos: dono apaga" on storage.objects;
alter table public.pets_inquilino drop constraint if exists pets_inquilino_fotos_max3;
alter table public.pets_inquilino drop column if exists fotos;
alter table public.pets_inquilino drop column if exists carteira_vacina;
delete from storage.buckets where id = 'pets-fotos' and not exists (select 1 from storage.objects where bucket_id = 'pets-fotos');
delete from supabase_migrations.schema_migrations where version = '20261019000179';
commit;

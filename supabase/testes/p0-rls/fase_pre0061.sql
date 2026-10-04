-- Estado de produção ANTES da 0061: property_photos/property_workspaces com
-- RLS ligada e nenhuma política; sem internet_tier; trava de 8 fotos (0009).
reset role;
create table if not exists public.property_workspaces (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  name text
);
grant all on public.property_photos, public.property_workspaces to anon, authenticated;
alter table public.property_photos enable row level security;
alter table public.property_workspaces enable row level security;
create or replace function public.enforce_min_photos() returns trigger language plpgsql as $$
begin
  if new.status = 'active' and coalesce(new.photo_count, 0) < 8 then
    raise exception 'Anúncio precisa de pelo menos 8 fotos para ser publicado.';
  end if;
  return new;
end; $$;
create trigger properties_min_photos before update of status on public.properties
  for each row execute function public.enforce_min_photos();

-- Rascunho com 8 fotos só no draft_data (o caso do proprietario1) + 1 de fora da pasta.
update public.properties set status = 'draft', draft_data = jsonb_build_object('photos', (
  select jsonb_agg(jsonb_build_object('id', g::text, 'url',
    'https://x.supabase.co/storage/v1/object/public/property-photos/11111111-1111-1111-1111-111111111111/' || g || '.jpg'))
  from generate_series(1, 8) g) || jsonb_build_array(jsonb_build_object('url', 'https://evil.example/x.jpg')))
 where id = 'aaaaaaa4-0000-0000-0000-000000000004';
update public.properties set status = 'draft' where id = 'aaaaaaa4-0000-0000-0000-000000000004';

set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ANTES@0061','dono NÃO consegue gravar foto (RLS sem política)','falha',$q$insert into property_photos(property_id,url) values ('aaaaaaa2-0000-0000-0000-000000000002','https://x.supabase.co/storage/v1/object/public/property-photos/11111111-1111-1111-1111-111111111111/a.jpg')$q$);
select t('ANTES@0061','qualificação com internet_tier falha (coluna não existe)','falha',$q$insert into qualification_checklists(owner_id,internet_tier) values ('11111111-1111-1111-1111-111111111111','home_office')$q$);
reset role;

-- Viva Nomads — aplicar 0149 (perfil público do proprietário + bio/idiomas/cidade). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0149_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'bio') then
    alter table public.profiles add column bio text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'idiomas') then
    alter table public.profiles add column idiomas text[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'cidade') then
    alter table public.profiles add column cidade text;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_tamanho') then
    alter table public.profiles add constraint profiles_bio_tamanho check (bio is null or char_length(bio) <= 280);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_idiomas_qtd') then
    alter table public.profiles add constraint profiles_idiomas_qtd check (cardinality(idiomas) <= 8);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_cidade_tamanho') then
    alter table public.profiles add constraint profiles_cidade_tamanho check (cidade is null or char_length(cidade) <= 60);
  end if;
end $$;

-- O próprio usuário edita bio, idiomas e cidade (a validação de contato é do servidor; o tamanho, do banco).
grant update (bio, idiomas, cidade) on public.profiles to authenticated;

create or replace function public.perfil_publico_proprietario(p_dono uuid)
returns table (
  nome_curto text,
  avatar_url text,
  desde timestamptz,
  cidade text,
  bio text,
  idiomas text[],
  email_confirmado boolean,
  imoveis_ativos integer,
  estadias_concluidas integer,
  conversas integer,
  conversas_respondidas integer,
  resposta_media_min integer
)
language sql
stable
security definer
set search_path = public
as $$
  with entrada as (
    select m.conversation_id, min(m.created_at) as t0
      from public.messages m
     where m.receiver_id = p_dono
     group by m.conversation_id
  ),
  resposta as (
    select e.t0,
           (select min(r.created_at) from public.messages r
             where r.conversation_id = e.conversation_id and r.sender_id = p_dono and r.created_at > e.t0) as t1
      from entrada e
  )
  select
    case
      when array_length(regexp_split_to_array(btrim(coalesce(pr.full_name, '')), '\s+'), 1) > 1
        then split_part(btrim(pr.full_name), ' ', 1) || ' ' ||
             upper(left((regexp_split_to_array(btrim(pr.full_name), '\s+'))[array_length(regexp_split_to_array(btrim(pr.full_name), '\s+'), 1)], 1)) || '.'
      else nullif(split_part(btrim(coalesce(pr.full_name, '')), ' ', 1), '')
    end as nome_curto,
    pr.avatar_url,
    pr.created_at as desde,
    pr.cidade,
    pr.bio,
    coalesce(pr.idiomas, '{}') as idiomas,
    (u.email_confirmed_at is not null) as email_confirmado,
    (select count(*)::int from public.properties p where p.owner_id = p_dono and p.status = 'active') as imoveis_ativos,
    (select count(*)::int from public.contratos c join public.properties p on p.id = c.property_id
      where p.owner_id = p_dono and c.status in ('concluido', 'encerrado_sem_renovacao', 'encerrado_em_acerto')) as estadias_concluidas,
    (select count(*)::int from resposta) as conversas,
    (select count(*)::int from resposta where t1 is not null) as conversas_respondidas,
    (select round(avg(extract(epoch from (t1 - t0)) / 60))::int from resposta where t1 is not null) as resposta_media_min
  from public.profiles pr
  left join auth.users u on u.id = pr.id
  where pr.id = p_dono
    and exists (select 1 from public.properties p where p.owner_id = p_dono)
$$;

revoke all on function public.perfil_publico_proprietario(uuid) from public, anon, authenticated;
grant execute on function public.perfil_publico_proprietario(uuid) to service_role;
comment on function public.perfil_publico_proprietario(uuid) is
  'Perfil público de quem anuncia (0149): nome curto, cidade, bio, idiomas, desde, e-mail confirmado, contagens e resposta no chat. Sem e-mail, telefone ou documento. Só service_role.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261017000149', '0149_perfil_publico_proprietario',
       array['-- conteúdo em supabase/migrations/0149_perfil_publico_proprietario.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261017000149');
commit;

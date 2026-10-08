-- Viva Nomads — aplicar 0094 (avisos do Moacir ao Daniel por e-mail).
-- Aplicada pela Action "Aplicar migrações em produção" quando o PR é mesclado (o merge é a aprovação).
-- Rollback: supabase/producao/rollback/0094_rollback.sql. Só cria coisas novas. Sem DROP.
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public.avisos_daniel') is null then
    create table public.avisos_daniel (
      id uuid primary key default gen_random_uuid(),
      origem_ronda uuid references public.agentes_rondas(id) on delete set null,
      assunto text not null check (char_length(assunto) between 1 and 200),
      corpo text not null default '' check (char_length(corpo) <= 1000),
      prioridade text not null default 'P1' check (prioridade in ('P0', 'P1', 'P2', 'P3')),
      link text check (link is null or link ~ '^https://claude\.ai/[A-Za-z0-9/_-]+$'),
      via text check (via in ('email', 'resumo')),
      tentativas smallint not null default 0,
      criado_em timestamptz not null default now(),
      enviado_em timestamptz,
      erro text check (erro is null or char_length(erro) <= 300)
    );
    create index avisos_daniel_fila on public.avisos_daniel (criado_em) where enviado_em is null;
    create index avisos_daniel_assunto on public.avisos_daniel (assunto, criado_em desc);
  end if;
end;
$$;

alter table public.avisos_daniel enable row level security;
revoke all on public.avisos_daniel from public, anon, authenticated;
grant select on public.avisos_daniel to authenticated;
grant all on public.avisos_daniel to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'avisos_daniel' and policyname = 'avisos_daniel: admin le') then
    create policy "avisos_daniel: admin le" on public.avisos_daniel
      for select to authenticated using (public.is_admin());
  end if;
end;
$$;

create or replace function public.avisos_daniel_da_ronda()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  a jsonb;
  v_assunto text;
  v_corpo text := '';
  v_pri text;
  v_para_daniel boolean := false;
begin
  if new.agente_slug <> 'moacir' then
    return new;
  end if;

  for a in
    select e from jsonb_array_elements(case when jsonb_typeof(new.achados) = 'array' then new.achados else '[]'::jsonb end) e
  loop
    if lower(coalesce(a->>'para', '')) = 'daniel' then
      v_para_daniel := true;
      if upper(coalesce(a->>'prioridade', '')) in ('P0', 'P1', 'P2', 'P3')
         and (v_pri is null or upper(a->>'prioridade') < v_pri) then
        v_pri := upper(a->>'prioridade');
      end if;
      if v_assunto is null then
        v_assunto := left(btrim(coalesce(a->>'titulo', a->>'detalhe', '')), 120);
        v_corpo := left(btrim(coalesce(a->>'detalhe', a->>'titulo', '')), 600);
      end if;
    end if;
  end loop;

  if not v_para_daniel and new.status <> 'alerta' then
    return new;
  end if;

  v_assunto := coalesce(nullif(v_assunto, ''), nullif(left(btrim(split_part(new.resumo, E'\n', 1)), 120), ''), 'Ronda do Moacir em alerta');
  v_pri := coalesce(v_pri, 'P1');

  if exists (select 1 from public.avisos_daniel where assunto = v_assunto and criado_em > now() - interval '24 hours') then
    return new;
  end if;

  insert into public.avisos_daniel (origem_ronda, assunto, corpo, prioridade)
  values (new.id, v_assunto, v_corpo, v_pri);
  return new;
exception when others then
  return new; -- o aviso nunca pode impedir o registro da ronda
end;
$fn$;

revoke all on function public.avisos_daniel_da_ronda() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'avisos_daniel_da_ronda' and tgrelid = 'public.agentes_rondas'::regclass) then
    create trigger avisos_daniel_da_ronda
      after insert on public.agentes_rondas
      for each row execute function public.avisos_daniel_da_ronda();
  end if;
end;
$$;

-- Primeiro aviso da fila: a apresentação (14 slides). Sem dado pessoal.
insert into public.avisos_daniel (assunto, corpo, prioridade, link)
select 'Apresentação da Viva Nomads (14 slides)',
       'Primeiro aviso enviado por moacir@vivanomads.com.br: a apresentação da Viva Nomads, em 14 slides.',
       'P3',
       'https://claude.ai/artifact/VVqFDPcKhT9Xq3GvKMTewn'
 where not exists (select 1 from public.avisos_daniel where assunto = 'Apresentação da Viva Nomads (14 slides)');

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261008000094', '0094_avisos_daniel',
       array['-- conteúdo em supabase/migrations/0094_avisos_daniel.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261008000094');
commit;

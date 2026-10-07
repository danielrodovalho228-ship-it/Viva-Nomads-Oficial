-- Viva Nomads — aplicar 0077 (mural de pedidos sem SECURITY DEFINER) em produção.
-- SQL Editor ou ferramenta do Supabase: nenhum comando gera NOTICE. Tudo ou nada; reaplicar é seguro.
-- Conteúdo = supabase/migrations/0077_pedidos_publicos_invoker.sql.
begin;

create or replace function public.pedidos_publicos_lista()
returns table (
  id uuid,
  cidade text,
  uf text,
  data_inicio date,
  prazo_meses integer,
  orcamento_mensal numeric(12, 2),
  qtd_ocupantes integer,
  motivo text,
  apresentacao text,
  status text,
  criado_em timestamptz,
  expira_em timestamptz,
  inquilino_verificado boolean,
  pets boolean,
  criancas boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.cidade, p.uf, p.data_inicio, p.prazo_meses, p.orcamento_mensal, p.qtd_ocupantes,
         p.motivo, p.apresentacao, p.status, p.criado_em, p.expira_em,
         coalesce(pf.verification_progress, 0) >= 100,
         p.pets, p.criancas
    from public.pedidos_moradia p
    join public.profiles pf on pf.id = p.inquilino_id
   where p.status = 'ativo' and p.expira_em > now()
$$;
revoke all on function public.pedidos_publicos_lista() from public;
grant execute on function public.pedidos_publicos_lista() to anon, authenticated, service_role;

create or replace view public.pedidos_publicos
  with (security_invoker = on)
as
  -- numeric(12,2) explícito: o retorno da função perde a precisão, e a view
  -- não pode mudar o tipo da coluna (em produção ela é numeric(12,2)).
  select l.id, l.cidade, l.uf, l.data_inicio, l.prazo_meses, l.orcamento_mensal::numeric(12, 2) as orcamento_mensal, l.qtd_ocupantes,
         l.motivo, l.apresentacao, l.status, l.criado_em, l.expira_em, l.inquilino_verificado,
         l.pets, l.criancas
    from public.pedidos_publicos_lista() l;

revoke insert, update, delete, truncate, references, trigger on public.pedidos_publicos from anon, authenticated;
grant select on public.pedidos_publicos to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
values ('20261007000077', '0077_pedidos_publicos_invoker', array['-- aplicada em partes/SQL Editor; conteúdo em supabase/migrations/0077_pedidos_publicos_invoker.sql'], 'danielrodovalho228@gmail.com')
on conflict (version) do nothing;
commit;

-- Conferência: view security_invoker, mesmas colunas/tipo, e o mural continua lendo.
select (select reloptions from pg_class where oid = 'public.pedidos_publicos'::regclass) as opcoes,
       (select format_type(a.atttypid, a.atttypmod) from pg_attribute a where a.attrelid = 'public.pedidos_publicos'::regclass and a.attname = 'orcamento_mensal') as tipo_orcamento,
       (select count(*) from public.pedidos_publicos) as pedidos_no_mural,
       (select name from supabase_migrations.schema_migrations where version = '20261007000077') as migracao;

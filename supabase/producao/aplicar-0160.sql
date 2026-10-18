-- Viva Nomads — aplicar 0160 (pedido de moradia só chega aos proprietários com e-mail e telefone confirmados). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0160_rollback.sql.
begin;
set local lock_timeout = '5s';

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
    join auth.users u on u.id = p.inquilino_id
    join public.telefone_verificacao tv on tv.user_id = p.inquilino_id
   where p.status = 'ativo' and p.expira_em > now()
     and u.email_confirmed_at is not null
     and u.phone_confirmed_at is not null
     and tv.verificado_em is not null
$$;
revoke all on function public.pedidos_publicos_lista() from public, anon;
grant execute on function public.pedidos_publicos_lista() to authenticated, service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261018000160', '0160_pedidos_contato_confirmado',
       array['-- conteúdo em supabase/migrations/0160_pedidos_contato_confirmado.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261018000160');
commit;

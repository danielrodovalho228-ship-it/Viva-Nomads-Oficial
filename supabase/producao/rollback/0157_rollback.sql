-- Rollback da 0157: o mural volta a listar todo pedido ativo (definição da 0077/0083).
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
revoke all on function public.pedidos_publicos_lista() from public, anon;
grant execute on function public.pedidos_publicos_lista() to authenticated, service_role;
delete from supabase_migrations.schema_migrations where version = '20261018000157';
commit;

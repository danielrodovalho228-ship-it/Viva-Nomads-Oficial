-- 0077 — Mural de pedidos: a view deixa de ser SECURITY DEFINER (advisor ERROR).
--
-- public.pedidos_publicos rodava com as permissões de quem a criou. Ela precisa
-- ler pedidos de outras pessoas (o mural é público) sem abrir a tabela
-- pedidos_moradia, cuja RLS só mostra ao próprio inquilino. Por isso:
--   • a leitura passa para UMA função security definer, com search_path fixo,
--     que devolve SÓ as colunas públicas (sem id/nome/contato do inquilino) e
--     só pedidos ativos e não expirados;
--   • a view vira security_invoker e apenas chama essa função — mesmo nome,
--     mesmas colunas e mesmo tipo; o site e o funil reverso não mudam.
-- Sem "drop ... if exists" (a ferramenta do Supabase trava com NOTICE).
-- Reaplicar é seguro.

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
  select l.id, l.cidade, l.uf, l.data_inicio, l.prazo_meses, l.orcamento_mensal, l.qtd_ocupantes,
         l.motivo, l.apresentacao, l.status, l.criado_em, l.expira_em, l.inquilino_verificado,
         l.pets, l.criancas
    from public.pedidos_publicos_lista() l;

-- Só leitura (como na 0070).
revoke insert, update, delete, truncate, references, trigger on public.pedidos_publicos from anon, authenticated;
grant select on public.pedidos_publicos to anon, authenticated;

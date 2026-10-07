-- ROLLBACK da 0077: volta a view como era (0064) e remove a função.
begin;
create or replace view public.pedidos_publicos
  with (security_invoker = off)
as
 select p.id, p.cidade, p.uf, p.data_inicio, p.prazo_meses, p.orcamento_mensal, p.qtd_ocupantes,
    p.motivo, p.apresentacao, p.status, p.criado_em, p.expira_em,
    coalesce(pf.verification_progress, 0) >= 100 as inquilino_verificado,
    p.pets, p.criancas
   from public.pedidos_moradia p
     join public.profiles pf on pf.id = p.inquilino_id
  where p.status = 'ativo' and p.expira_em > now();
drop function public.pedidos_publicos_lista();
commit;

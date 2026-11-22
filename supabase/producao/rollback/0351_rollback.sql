-- Viva Nomads — rollback da 0351 (E1084): a função volta a ler o nome público do parceiro (a definição da 0324). Nunca roda sozinho.
begin;
set local lock_timeout = '5s';
create or replace function public.avaliadores_publicos()
returns table (numero_credenciado text, nome_curto text, cidade text, avaliacoes_feitas integer, nota_conduta numeric, teste boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.numero_credenciado,
         split_part(btrim(p.nome_publico), ' ', 1),
         c.cidade,
         (select count(*)::integer from public.vistoria_pedidos v where v.avaliador_id = c.id and v.status = 'laudo_emitido' and not v.teste),
         (select round(avg((k.pontualidade + k.cordialidade + k.cuidado) / 3.0), 1) from public.vistoria_conduta k
           where k.avaliador_id = c.id and k.autor = 'dono' and k.publicada_em is not null),
         coalesce(pf.is_teste, false)
    from public.avaliadores_credenciamento c
    join public.parceiros p on p.id = c.parceiro_id
    left join public.profiles pf on pf.id = p.user_id
   where c.status in ('ativo', 'em_teste')
$$;
revoke all on function public.avaliadores_publicos() from public;
grant execute on function public.avaliadores_publicos() to anon, authenticated, service_role;
delete from supabase_migrations.schema_migrations where version = '20261122000351';
commit;

-- E1084 (ORDEM-DUET-399): o nome do avaliador na página pública passa a vir da CONTA (profiles.full_name, sem as marcas
-- de teste do começo), a mesma fonte da lista de escolha do dono, do laudo e do admin (src/lib/vistoria/nome-do-avaliador.ts).
-- Sem nome na conta (ou com e-mail no lugar), o nome público do parceiro, como antes. Só redefine a função; dados não mudam.
-- Rollback: supabase/producao/rollback/0351_rollback.sql

create or replace function public.avaliadores_publicos()
returns table (numero_credenciado text, nome_curto text, cidade text, avaliacoes_feitas integer, nota_conduta numeric, teste boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.numero_credenciado,
         -- E1084: o primeiro nome vem da CONTA (sem as marcas "[TESTE QA]" do começo; sem nome ou com e-mail no lugar,
         -- o nome público do parceiro) — a mesma fonte da lista de escolha, do laudo e do admin.
         split_part(
           case
             when nullif(btrim(regexp_replace(btrim(pf.full_name), '^(\[[^\]]*\]\s*)+', '')), '') is not null
              and position('@' in pf.full_name) = 0
               then btrim(regexp_replace(btrim(pf.full_name), '^(\[[^\]]*\]\s*)+', ''))
             else btrim(p.nome_publico)
           end, ' ', 1),
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

-- 0220 — Correção 62-B3: a porta de entrada do avaliador credenciado. Pedido único (quem não é parceiro manda os dados
-- de parceiro e os do credenciamento no mesmo formulário) e uma só aprovação (o admin ativa o parceiro e põe o
-- credenciamento em teste na mesma ação). Sem dados novos de pessoa. Idempotente.
-- 1. A categoria "vistoria" pode entrar na solicitação de parceiro (o servidor só a aceita pelo caminho do credenciamento;
--    a validação comum continua recusando).
alter table public.parceiro_solicitacoes drop constraint if exists parceiro_solicitacoes_categorias;
alter table public.parceiro_solicitacoes add constraint parceiro_solicitacoes_categorias check (
  categorias <@ array['fotografia', 'mudanca', 'limpeza', 'lavanderia', 'montagem', 'manutencao', 'outro', 'vistoria']::text[]
);

-- 2. Credenciamento de quem ainda não é parceiro: fica ligado à pessoa e à solicitação; o parceiro_id chega na aprovação.
alter table public.avaliadores_credenciamento alter column parceiro_id drop not null;
alter table public.avaliadores_credenciamento add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.avaliadores_credenciamento add column if not exists solicitacao_id uuid references public.parceiro_solicitacoes (id) on delete set null;
update public.avaliadores_credenciamento c set user_id = p.user_id from public.parceiros p where p.id = c.parceiro_id and c.user_id is null;
alter table public.avaliadores_credenciamento drop constraint if exists avaliadores_credenciamento_dono;
alter table public.avaliadores_credenciamento add constraint avaliadores_credenciamento_dono
  check (parceiro_id is not null or (user_id is not null and solicitacao_id is not null));
create unique index if not exists avaliadores_credenciamento_usuario on public.avaliadores_credenciamento (user_id) where user_id is not null;
drop policy if exists avaliadores_credenciamento_le on public.avaliadores_credenciamento;
create policy avaliadores_credenciamento_le on public.avaliadores_credenciamento for select to authenticated
  using (public.parceiro_meu(parceiro_id) or user_id = (select auth.uid()) or public.is_admin());

-- 3. A página do avaliador abre também em teste (noindex enquanto VISTORIA_ATIVA estiver desligada; o rodízio só
--    designa ativos). Mesmas colunas da 0215: sem documento, contato, relações.
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
           where k.avaliador_id = c.id and k.autor = 'dono'),
         coalesce(pf.is_teste, false)
    from public.avaliadores_credenciamento c
    join public.parceiros p on p.id = c.parceiro_id
    left join public.profiles pf on pf.id = p.user_id
   where c.status in ('ativo', 'em_teste')
$$;
revoke all on function public.avaliadores_publicos() from public;
grant execute on function public.avaliadores_publicos() to anon, authenticated, service_role;

-- 0324 — AVALIAÇÕES (E679-B, parte 3): a avaliação de CONDUTA do avaliador passa a ser CEGA, no mesmo modelo da estadia.
--
-- Achado (07/11/2026): a vistoria_conduta (0215) NÃO era cega. A política vistoria_conduta_le deixava o dono e o
-- avaliador lerem a avaliação um do outro assim que ela era gravada, e avaliadores_publicos() / a revisão de critérios
-- (E648) já contavam a nota do dono na hora. Corrigido:
--   • publicada_em: a conduta só vira visível ao outro lado (e entra na nota pública) quando os dois enviam OU quando a
--     janela de 14 dias, contada do laudo emitido, fecha. Mesmo desenho de publicar_avaliacoes (0089).
--   • Cada lado continua lendo a PRÓPRIA avaliação; a do outro só depois de publicada.
--   • Sem edição depois de enviada; só dentro de 14 dias do laudo emitido.
--   • O desenho NÃO muda: dono avalia pontualidade · cordialidade · cuidado com o imóvel; avaliador avalia imóvel pronto ·
--     horário respeitado; abre depois do laudo emitido; texto até 300 caracteres; avaliador × morador não existe.
-- Em produção a tabela tem 0 linhas (conferido em 07/11/2026): nenhuma migração de dados.
-- Rollback: supabase/producao/rollback/0324_rollback.sql

alter table public.vistoria_conduta add column if not exists publicada_em timestamptz;

-- Quando o laudo deste pedido foi emitido (a 1ª versão; a contestação gera pedido novo, que tem o próprio laudo).
create or replace function public.vistoria_laudo_emitido_em(p_pedido uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select min(l.emitido_em) from public.vistoria_laudos l where l.pedido_id = p_pedido or l.pedido_versao_id = p_pedido
$$;
revoke all on function public.vistoria_laudo_emitido_em(uuid) from public, anon, authenticated;
grant execute on function public.vistoria_laudo_emitido_em(uuid) to service_role;

-- Regras de gravação: só depois do laudo e até 14 dias dele; sem edição depois de enviada.
create or replace function public.vistoria_conduta_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  laudo timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.pedido_id is distinct from old.pedido_id or new.autor is distinct from old.autor
       or new.avaliador_id is distinct from old.avaliador_id or new.pontualidade is distinct from old.pontualidade
       or new.cordialidade is distinct from old.cordialidade or new.cuidado is distinct from old.cuidado
       or new.imovel_pronto is distinct from old.imovel_pronto or new.horario_respeitado is distinct from old.horario_respeitado
       or new.comentario is distinct from old.comentario or new.criado_em is distinct from old.criado_em then
      raise exception 'Avaliação de conduta enviada não pode ser alterada.' using errcode = '42501';
    end if;
    return new;
  end if;
  laudo := public.vistoria_laudo_emitido_em(new.pedido_id);
  if laudo is null then
    raise exception 'A avaliação de conduta abre depois do laudo.' using errcode = '23514';
  end if;
  if now() > laudo + interval '14 days' then
    raise exception 'O prazo para avaliar a conduta (14 dias depois do laudo) terminou.' using errcode = '23514';
  end if;
  new.publicada_em := null;
  return new;
end;
$$;
drop trigger if exists vistoria_conduta_valida on public.vistoria_conduta;
create trigger vistoria_conduta_valida before insert or update on public.vistoria_conduta
  for each row execute function public.vistoria_conduta_valida();
revoke all on function public.vistoria_conduta_valida() from public, anon, authenticated;

-- Publicação às cegas: as duas avaliações do pedido aparecem juntas quando as duas chegam, ou quando vence a janela.
create or replace function public.publicar_conduta_avaliador(p_pedido uuid default null)
returns integer
language sql
security definer
set search_path = public
as $$
  with pub as (
    update public.vistoria_conduta k
       set publicada_em = now()
     where k.publicada_em is null
       and (p_pedido is null or k.pedido_id = p_pedido)
       and (exists (select 1 from public.vistoria_conduta o where o.pedido_id = k.pedido_id and o.autor <> k.autor)
            or public.vistoria_laudo_emitido_em(k.pedido_id) + interval '14 days' <= now())
    returning 1
  )
  select count(*)::int from pub
$$;
revoke all on function public.publicar_conduta_avaliador(uuid) from public, anon, authenticated;
grant execute on function public.publicar_conduta_avaliador(uuid) to service_role;

create or replace function public.vistoria_conduta_apos_envio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.publicar_conduta_avaliador(new.pedido_id);
  return null;
end;
$$;
drop trigger if exists vistoria_conduta_apos_envio on public.vistoria_conduta;
create trigger vistoria_conduta_apos_envio after insert on public.vistoria_conduta
  for each row execute function public.vistoria_conduta_apos_envio();
revoke all on function public.vistoria_conduta_apos_envio() from public, anon, authenticated;

-- Leitura: o autor lê a própria; a do outro lado só depois de publicada. A equipe lê todas.
drop policy if exists vistoria_conduta_le on public.vistoria_conduta;
create policy vistoria_conduta_le on public.vistoria_conduta for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.vistoria_pedidos p
       where p.id = vistoria_conduta.pedido_id
         and (
           (vistoria_conduta.autor = 'dono' and p.owner_id = (select auth.uid()))
           or (vistoria_conduta.autor = 'avaliador' and public.vistoria_sou_avaliador(p.avaliador_id))
           or (vistoria_conduta.publicada_em is not null and (p.owner_id = (select auth.uid()) or public.vistoria_sou_avaliador(p.avaliador_id)))
         )
    )
  );

-- A nota pública de conduta do avaliador conta só o PUBLICADO (mesmas colunas da 0220).
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

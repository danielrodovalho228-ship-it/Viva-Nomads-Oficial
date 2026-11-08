-- Rollback da 0322 (E679-B parte 1). Devolve avaliacao_valida() à versão da 0089 e remove o gatilho de "fato falso".
-- Atenção: depois do rollback, o banco volta a aceitar critérios livres em notas_categorias.
begin;
drop trigger if exists avaliacao_contestacao_assunto_caucao on public.avaliacao_contestacoes;
drop function if exists public.avaliacao_contestacao_assunto_caucao();
create or replace function public.avaliacao_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  cliente boolean := coalesce(auth.role(), '') in ('authenticated', 'anon') and pg_trigger_depth() <= 1;
begin
  if tg_op = 'UPDATE' then
    if new.contrato_id is distinct from old.contrato_id or new.autor_id is distinct from old.autor_id or new.alvo_id is distinct from old.alvo_id then
      raise exception 'Contrato, autor e avaliado não mudam.' using errcode = '23514';
    end if;
    if cliente and old.status <> 'rascunho' then
      raise exception 'Avaliação enviada não pode ser alterada.' using errcode = '42501';
    end if;
  end if;
  if cliente then
    new.autor_id := auth.uid();
    if new.status not in ('rascunho', 'enviada') then
      raise exception 'Status inválido.' using errcode = '42501';
    end if;
    new.publicada_em := null;
  end if;

  select ct.status, ct.tenant_id, ct.encerrado_em, ct.property_id, pr.owner_id
    into c
    from public.contratos ct
    join public.properties pr on pr.id = ct.property_id
   where ct.id = new.contrato_id;
  if not found then
    raise exception 'Contrato não encontrado.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if c.status not in ('concluido', 'encerrado_sem_renovacao', 'encerrado_em_acerto') or c.encerrado_em is null then
      raise exception 'Só é possível avaliar depois do fim do contrato.' using errcode = '23514';
    end if;
    if now() > c.encerrado_em + interval '14 days' then
      raise exception 'O prazo para avaliar (14 dias depois do fim do contrato) terminou.' using errcode = '23514';
    end if;
  end if;
  if new.autor_id = c.tenant_id and new.alvo_id = c.owner_id then
    new.papel_autor := 'inquilino';
  elsif new.autor_id = c.owner_id and new.alvo_id = c.tenant_id then
    new.papel_autor := 'proprietario';
  else
    raise exception 'Autor e avaliado precisam ser as partes do contrato.' using errcode = '23514';
  end if;
  new.imovel_id := c.property_id;

  -- Enviada agora: data de envio + filtro (contato ou ofensa → moderação).
  if new.status = 'enviada' and (tg_op = 'INSERT' or old.status = 'rascunho') then
    new.enviada_em := now();
    if public.contem_contato(new.comentario_publico, true) or public.contem_contato(new.nota_privada_parte, true) then
      new.status := 'em_moderacao';
      new.moderacao_motivo := 'contato (telefone, e-mail ou rede social)';
    elsif public.contem_ofensa(new.comentario_publico) or public.contem_ofensa(new.nota_privada_parte) then
      new.status := 'em_moderacao';
      new.moderacao_motivo := 'ofensa ou discriminação';
    end if;
  end if;
  return new;
end;
$$;
drop function if exists public.contem_documento(text);
delete from supabase_migrations.schema_migrations where version = '20261107000322';
commit;

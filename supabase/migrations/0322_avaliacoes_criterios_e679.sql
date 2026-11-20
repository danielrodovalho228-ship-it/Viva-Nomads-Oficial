-- 0322 — AVALIAÇÕES (E679-B, parte 1): critérios FIXOS por par na estadia, dado pessoal (inclui documento) vai para a
-- moderação, e "fato falso" nunca sobre dano, sujeira ou caução.
--
-- Pedido do Daniel (mockups aprovados em 07/11/2026). Em produção avaliacoes, avaliacao_respostas e
-- avaliacao_contestacoes têm 0 linhas (conferido em 07/11/2026): nenhuma migração de dados.
--   • Morador avalia: imóvel como no anúncio · limpeza na chegada · comunicação.
--   • Proprietário avalia: cuidado com o imóvel · regras da casa · comunicação.
--   • Ao ENVIAR: os três critérios (1 a 5), "recomendaria" (sim/não) e até 5 etiquetas. Rascunho segue livre.
--   • Moderação só por ofensa ou dado pessoal (telefone, e-mail, rede, documento). Nota baixa legítima nunca é barrada.
--   • Pedido de revisão por "fato falso" não pode falar de dano, sujeira, caução ou valor: a avaliação pública não é
--     prova em disputa de caução e a Viva não a usa para decidir a disputa.
-- Rollback: supabase/producao/rollback/0322_rollback.sql

-- Documento (CPF/CNPJ) no texto = dado pessoal.
create or replace function public.contem_documento(t text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(t ~ '(^|[^0-9])([0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}|[0-9]{2}\.?[0-9]{3}\.?[0-9]{3}/?[0-9]{4}-?[0-9]{2})([^0-9]|$)', false)
$$;

create or replace function public.avaliacao_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  chaves text[];
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

  -- E679: critérios FIXOS por par. Quem é morador avalia o dono (imóvel como no anúncio, limpeza na chegada,
  -- comunicação); o dono avalia o morador (cuidado com o imóvel, regras da casa, comunicação).
  chaves := case new.papel_autor
    when 'inquilino' then array['imovel_como_anuncio', 'limpeza_chegada', 'comunicacao']
    else array['cuidado_imovel', 'regras_casa', 'comunicacao'] end;
  if exists (select 1 from jsonb_object_keys(new.notas_categorias) k where k <> all (chaves)) then
    raise exception 'Esse critério não existe nesta avaliação.' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_each(new.notas_categorias) e
              where jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}') !~ '^[1-5]$') then
    raise exception 'A nota de cada critério vai de 1 a 5.' using errcode = '23514';
  end if;
  if new.status <> 'rascunho' then
    if (select count(*) from jsonb_object_keys(new.notas_categorias)) <> 3 then
      raise exception 'Dê uma nota de 1 a 5 para cada um dos três critérios.' using errcode = '23514';
    end if;
    if new.recomendaria is null then
      raise exception 'Diga se recomendaria (sim ou não).' using errcode = '23514';
    end if;
  end if;
  if cardinality(new.etiquetas) > 5 or exists (select 1 from unnest(new.etiquetas) t where char_length(t) > 40) then
    raise exception 'Escolha até 5 etiquetas.' using errcode = '23514';
  end if;

  -- Enviada agora: data de envio + filtro (contato ou ofensa → moderação).
  if new.status = 'enviada' and (tg_op = 'INSERT' or old.status = 'rascunho') then
    new.enviada_em := now();
    if public.contem_contato(new.comentario_publico, true) or public.contem_contato(new.nota_privada_parte, true)
       or public.contem_documento(new.comentario_publico) or public.contem_documento(new.nota_privada_parte) then
      new.status := 'em_moderacao';
      new.moderacao_motivo := 'dado pessoal (telefone, e-mail, rede social ou documento)';
    elsif public.contem_ofensa(new.comentario_publico) or public.contem_ofensa(new.nota_privada_parte) then
      new.status := 'em_moderacao';
      new.moderacao_motivo := 'ofensa ou discriminação';
    end if;
  end if;
  return new;
end;
$$;

-- "Fato falso" só para fato verificável pela Viva. Mesma lista de src/lib/avaliacoes-criterios.ts (RE_ASSUNTO_CAUCAO).
create or replace function public.avaliacao_contestacao_assunto_caucao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.motivo = 'fato_falso'
     and translate(lower(new.detalhe), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
         ~ '\m(caucao|deposito|garantia|dano|danific|estrag|quebr|sujeir|sujo|suja|limpeza|conserto|desconto|descontad|ressarc|indeniza|devolucao)'
  then
    raise exception '“Fato falso” vale só para o que a Viva consegue conferir. Dano, sujeira e valor de caução não entram aqui: a avaliação não decide a disputa da caução.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists avaliacao_contestacao_assunto_caucao on public.avaliacao_contestacoes;
create trigger avaliacao_contestacao_assunto_caucao before insert on public.avaliacao_contestacoes
  for each row execute function public.avaliacao_contestacao_assunto_caucao();
revoke all on function public.avaliacao_contestacao_assunto_caucao() from public, anon, authenticated;
revoke all on function public.contem_documento(text) from public, anon;
grant execute on function public.contem_documento(text) to authenticated, service_role;

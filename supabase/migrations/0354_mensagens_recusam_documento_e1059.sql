-- Viva Nomads — 0354 (E1059, perna de servidor). Aplicar em produção: supabase/producao/aplicar-0354.sql
-- Rollback: supabase/producao/rollback/0354_rollback.sql
-- E1059 (perna de servidor, ORDEM-DUET-433): o chat não guarda CPF nem RG por nenhum caminho. A tela e a Server Action
-- (sendMessage) já recusam; faltava o banco: pela inserção direta em `messages` (chave pública + sessão), o gatilho
-- messages_mask_contact (0057/0287) tratava o CPF como telefone e gravava a mensagem MASCARADA, entregue à outra parte.
-- A regra aprovada para documento é RECUSA, nunca máscara. Agora o gatilho recusa a linha (nada se grava, nada se entrega)
-- quando o texto traz CPF ou RG, pelas mesmas regras do contact-guard.ts (`documento`); para o resto do contato
-- (telefone, e-mail, mensageiros, links, redes) a máscara continua igual.
-- Só funções; nenhuma tabela, política ou dado muda.

-- O texto traz CPF ou RG? Espelha as cinco regras de documento do contact-guard.ts, na mesma ordem:
-- RG com rótulo, CPF com rótulo, CPF com a forma 000.000.000-00 (mesmo com dígito verificador inválido),
-- 11 dígitos com dígito verificador válido e RG pela máscara (12.345.678-9, com ou sem UF).
create or replace function public.contem_documento(t text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  r text;
  m text;
begin
  if t is null or t = '' then
    return false;
  end if;
  -- Ids (UUID) não são documento: saem antes das regras, como no contact-guard.ts.
  r := regexp_replace(t, '\y[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\y', '§', 'gi');
  if r ~* '\y(?:RG|R\.G\.|identidade)\s*(?:n[ºo°]?\.?\s*)?[-:]?\s*(?:[A-Z]{2}[-\s]?)?[\d.xX-]{5,15}' then
    return true;
  end if;
  if r ~* '\y(?:CPF|C\.P\.F\.?)\s*(?:n[ºo°]?\.?\s*)?(?:[ée]\s+)?[-:]?\s*\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}(?!\d)' then
    return true;
  end if;
  if r ~ '(?<![\d.-])\d{3}\.\d{3}\.\d{3}-\d{2}(?![\d-])' then
    return true;
  end if;
  for m in select (regexp_matches(r, '(?<![\d.-])\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}(?![\d-])', 'g'))[1] loop
    if public.cpf_valido(m) then
      return true;
    end if;
  end loop;
  return r ~ '(?<![\w.])(?:[A-Z]{2}[-\s]?)?\d{1,2}\.\d{3}\.\d{3}(?:-[\dXx])?(?![\w.])';
end;
$$;
revoke all on function public.contem_documento(text) from public, anon;
grant execute on function public.contem_documento(text) to authenticated, service_role;

-- O gatilho das mensagens: documento RECUSA a linha; o resto do contato segue mascarado (mask_contact, sem mudança).
create or replace function public.trg_mask_body()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.contem_documento(new.body) then
    raise exception 'Para dados de documento, use o campo Ocupantes da estadia' using errcode = '23514';
  end if;
  new.body := public.mask_contact(new.body);
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 0057 — P1 (b): A6 (contratos, blocos, pagamentos, locações, assinatura),
-- A1 (candidatura e resposta a Pedido sem reescrita pelo dono) e A2 (máscara/
-- bloqueio de contato NO BANCO). Aplicar DEPOIS da 0052. Idempotente.
--
--   A6  subscriptions: o dono só LÊ a própria assinatura (o plano muda só pelo
--       servidor/webhook). Antes: FOR ALL — dava para se dar o plano Gestor.
--   A6  contratos / contrato_blocos: sem escrita do usuário — o contrato nasce
--       no servidor a partir da candidatura ACEITA (inquilino, aluguel e taxa
--       vêm dela). Novo contratos.lead_id (um contrato por candidatura).
--   A6  pagamentos_bloco: o dono registra (bloco tem que ser do contrato); o
--       inquilino só CONFIRMA (não altera valor/data; não desconfirma).
--   A6  locacoes: só com candidatura aceita daquele imóvel.
--   A1  leads: sai "dono decide candidatura" (dava para trocar o inquilino e a
--       taxa congelada); aceitar/recusar só pelo servidor. O insert do
--       inquilino não pode trazer campos de decisão.
--   A1  respostas_pedido: dono só marca 'vista'; inquilino do pedido aceita
--       ou recusa; ninguém troca pedido/imóvel/dono/mensagem.
--   A1  primeiros_nomes(): só o 1º nome de quem tem conversa/candidatura com
--       você (a lista de conversas deixa de mostrar só "Conversa").
--   A2  mask_contact() em messages.body (mesmas regras do contact-guard.ts);
--       contem_contato() bloqueia contato direto nos textos livres.
--
-- Rollback: supabase/producao/rollback/0057_rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── A6 — assinatura: só leitura para o dono ─────────────────────────────────
drop policy if exists "assinatura do dono" on public.subscriptions;
drop policy if exists "dono lê a própria assinatura" on public.subscriptions;
create policy "dono lê a própria assinatura" on public.subscriptions
  for select using (owner_id = auth.uid());

-- ── A6 — contratos e blocos: só o servidor escreve ──────────────────────────
alter table public.contratos add column if not exists lead_id uuid references public.leads (id) on delete set null;
create unique index if not exists contratos_lead_id_key on public.contratos (lead_id) where lead_id is not null;
drop policy if exists "inquilino cria contrato" on public.contratos;
drop policy if exists "partes atualizam contrato" on public.contratos;
drop policy if exists "partes criam bloco" on public.contrato_blocos;
drop policy if exists "partes atualizam bloco" on public.contrato_blocos;

-- ── A6 — pagamentos: dono registra; inquilino só confirma ───────────────────
drop policy if exists "proprietário registra recebimento" on public.pagamentos_bloco;
create policy "proprietário registra recebimento" on public.pagamentos_bloco
  for insert with check (
    marcado_por = auth.uid()
    and coalesce(confirmado_pelo_inquilino, false) = false
    and confirmado_em is null
    and exists (
      select 1 from public.contratos c join public.properties p on p.id = c.property_id
      where c.id = pagamentos_bloco.contrato_id and p.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.contrato_blocos b
      where b.id = pagamentos_bloco.bloco_id and b.contrato_id = pagamentos_bloco.contrato_id
    )
  );

drop policy if exists "inquilino confirma pagamento" on public.pagamentos_bloco;
create policy "inquilino confirma pagamento" on public.pagamentos_bloco
  for update
  using (exists (select 1 from public.contratos c where c.id = pagamentos_bloco.contrato_id and c.tenant_id = auth.uid()))
  with check (exists (select 1 from public.contratos c where c.id = pagamentos_bloco.contrato_id and c.tenant_id = auth.uid()));
revoke update on public.pagamentos_bloco from authenticated, anon;
grant update (confirmado_pelo_inquilino) on public.pagamentos_bloco to authenticated;

create or replace function public.pagamentos_confirmacao()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;
  if coalesce(old.confirmado_pelo_inquilino, false) and not coalesce(new.confirmado_pelo_inquilino, false) then
    raise exception 'Pagamento já confirmado não pode ser desfeito' using errcode = '42501';
  end if;
  new.confirmado_em := case
    when coalesce(new.confirmado_pelo_inquilino, false) and not coalesce(old.confirmado_pelo_inquilino, false) then now()
    else old.confirmado_em
  end;
  return new;
end;
$$;
drop trigger if exists trg_pagamentos_confirmacao on public.pagamentos_bloco;
create trigger trg_pagamentos_confirmacao
  before update on public.pagamentos_bloco
  for each row execute function public.pagamentos_confirmacao();

-- ── A6 — locação só com candidatura aceita ──────────────────────────────────
drop policy if exists "inquilino cria locação" on public.locacoes;
create policy "inquilino cria locação" on public.locacoes
  for insert with check (
    tenant_id = auth.uid()
    and exists (
      select 1 from public.leads l
      where l.tenant_id = auth.uid() and l.property_id = locacoes.property_id and l.status = 'accepted'
    )
  );

-- ── A1 — candidatura: decisão só pelo servidor ──────────────────────────────
drop policy if exists "dono decide candidatura" on public.leads;
drop policy if exists "inquilino cria lead" on public.leads;
create policy "inquilino cria lead" on public.leads
  for insert with check (
    tenant_id = auth.uid()
    and status = 'new'
    and accepted_at is null and rejected_at is null and reject_reason is null
    and decided_by is null and accepted_plan is null and accepted_commission_rate is null
    and coalesce(contact_unlocked, false) = false
    and exists (
      select 1 from public.properties p
      where p.id = leads.property_id
        and p.status = 'active'
        and p.owner_id = leads.owner_id
    )
  );

-- ── A1 — resposta a Pedido de Moradia ───────────────────────────────────────
drop policy if exists "partes atualizam resposta" on public.respostas_pedido;
create policy "partes atualizam resposta" on public.respostas_pedido
  for update
  using (
    proprietario_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.pedidos_moradia p where p.id = respostas_pedido.pedido_id and p.inquilino_id = auth.uid())
  )
  with check (
    proprietario_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.pedidos_moradia p where p.id = respostas_pedido.pedido_id and p.inquilino_id = auth.uid())
  );
revoke update on public.respostas_pedido from authenticated, anon;
grant update (status, recusa_motivo) on public.respostas_pedido to authenticated;

create or replace function public.respostas_pedido_transicao()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  eh_inquilino boolean;
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') or public.is_admin() then
    return new;
  end if;
  if new.status is not distinct from old.status and new.recusa_motivo is not distinct from old.recusa_motivo then
    return new;
  end if;
  eh_inquilino := exists (
    select 1 from public.pedidos_moradia p where p.id = old.pedido_id and p.inquilino_id = auth.uid()
  );
  if eh_inquilino then
    -- Inquilino do pedido: aceita para conversar ou recusa (com motivo opcional).
    if old.status in ('enviada', 'vista') and new.status in ('aceita_para_conversa', 'recusada')
       and (new.status = 'recusada' or new.recusa_motivo is not distinct from old.recusa_motivo)
    then
      return new;
    end if;
  elsif old.proprietario_id = auth.uid() then
    -- Dono da resposta: só marca como vista.
    if old.status = 'enviada' and new.status = 'vista'
       and new.recusa_motivo is not distinct from old.recusa_motivo
    then
      return new;
    end if;
  end if;
  raise exception 'Mudança não permitida nesta resposta' using errcode = '42501';
end;
$$;
drop trigger if exists trg_respostas_pedido_transicao on public.respostas_pedido;
create trigger trg_respostas_pedido_transicao
  before update on public.respostas_pedido
  for each row execute function public.respostas_pedido_transicao();

-- ── A1 — 1º nome de quem tem relação com você ───────────────────────────────
create or replace function public.primeiros_nomes(ids uuid[])
returns table (id uuid, primeiro_nome text)
language sql
stable
security definer
set search_path = public
as $$
  select pf.id,
         nullif(split_part(trim(pf.full_name), ' ', 1), '') as primeiro_nome
  from public.profiles pf
  where pf.id = any (ids)
    and pf.id <> auth.uid()
    and pf.full_name is not null
    and position('@' in pf.full_name) = 0
    and pf.anonymized_at is null
    and (
      exists (select 1 from public.messages m
              where (m.sender_id = pf.id and m.receiver_id = auth.uid())
                 or (m.sender_id = auth.uid() and m.receiver_id = pf.id))
      or exists (select 1 from public.leads l
                 where (l.owner_id = auth.uid() and l.tenant_id = pf.id)
                    or (l.tenant_id = auth.uid() and l.owner_id = pf.id))
    );
$$;
revoke all on function public.primeiros_nomes(uuid[]) from public, anon;
grant execute on function public.primeiros_nomes(uuid[]) to authenticated;

-- ── A2 — máscara de contato nas mensagens (espelha contact-guard.ts) ────────
create or replace function public.mask_contact(t text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  r text := t;
  m text;
  k constant text := '🔒 [contato protegido]';
begin
  if r is null then
    return null;
  end if;
  r := regexp_replace(r, '(https?://)?(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me)/\S+', k, 'gi');
  r := regexp_replace(r, '[[:alnum:]_.+-]+@[[:alnum:]_-]+\.[[:alnum:]_.-]{2,}', k, 'g');
  for m in select (regexp_matches(r, '\+?\d[[:digit:][:space:]().-]{7,}\d', 'g'))[1] loop
    if length(regexp_replace(m, '\D', '', 'g')) between 10 and 13 then
      r := replace(r, m, k);
    end if;
  end loop;
  r := regexp_replace(r, '(https?://)?(www\.)?(instagram|facebook|fb|tiktok)\.com/\S+', k, 'gi');
  r := regexp_replace(r, '(^|[^[:alnum:]_@])@[A-Za-z0-9._]{2,30}', '\1' || k, 'g');
  return r;
end;
$$;

create or replace function public.trg_mask_body()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.body := public.mask_contact(new.body);
  return new;
end;
$$;
drop trigger if exists messages_mask_contact on public.messages;
create trigger messages_mask_contact
  before insert or update of body on public.messages
  for each row execute function public.trg_mask_body();

-- ── A2 — bloqueio de contato nos textos livres ──────────────────────────────
-- rigoroso = regra dos Pedidos (termos "zap/insta/me chama", 8+ dígitos);
-- não rigoroso = anúncio (sem termos — "face norte" é legítimo — e telefone
-- só com 10+ dígitos, para não pegar CEP).
create or replace function public.contem_contato(t text, rigoroso boolean default true)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  m text;
begin
  if t is null or t = '' then
    return false;
  end if;
  if t ~ '[[:alnum:]_.+-]+@[[:alnum:]_-]+\.[[:alnum:]_.-]{2,}' then
    return true;
  end if;
  if t ~* '(https?://)?(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me)/' then
    return true;
  end if;
  if t ~* '(https?://)?(www\.)?(instagram|facebook|fb|tiktok)\.com/' then
    return true;
  end if;
  if rigoroso then
    if t ~* '\m(whats\w*|zap+|telegram|te\s?legram|instagram|insta|facebook|face|chama\s+no|me\s+chama|liga\s+(pra|para)|meu\s+(n[úu]mero|whats|zap|contato))\M' then
      return true;
    end if;
    m := substring(t from '(?:\d[[:space:]().-]?){8,}');
    return m is not null and length(regexp_replace(m, '\D', '', 'g')) >= 8;
  end if;
  for m in select (regexp_matches(t, '\+?\d[[:digit:][:space:]().-]{7,}\d', 'g'))[1] loop
    if length(regexp_replace(m, '\D', '', 'g')) between 10 and 13 then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

-- Trigger genérico: TG_ARGV[0] = coluna, TG_ARGV[1] = 'rigoroso' | 'anuncio'.
-- Só checa quando o valor é novo ou mudou (textos antigos não são revalidados).
create or replace function public.bloqueia_contato_texto()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  novo text := to_jsonb(new) ->> tg_argv[0];
  antigo text := case when tg_op = 'UPDATE' then to_jsonb(old) ->> tg_argv[0] end;
begin
  if current_user in ('supabase_admin', 'postgres') then
    return new;
  end if;
  if novo is distinct from antigo and public.contem_contato(novo, tg_argv[1] = 'rigoroso') then
    raise exception 'Não é permitido informar telefone, e-mail ou rede social neste campo — a conversa segue pela plataforma.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists contato_pedido_apresentacao on public.pedidos_moradia;
create trigger contato_pedido_apresentacao before insert or update of apresentacao on public.pedidos_moradia
  for each row execute function public.bloqueia_contato_texto('apresentacao', 'rigoroso');
drop trigger if exists contato_resposta_mensagem on public.respostas_pedido;
create trigger contato_resposta_mensagem before insert or update of mensagem on public.respostas_pedido
  for each row execute function public.bloqueia_contato_texto('mensagem', 'rigoroso');
drop trigger if exists contato_resposta_motivo on public.respostas_pedido;
create trigger contato_resposta_motivo before insert or update of recusa_motivo on public.respostas_pedido
  for each row execute function public.bloqueia_contato_texto('recusa_motivo', 'rigoroso');
drop trigger if exists contato_avaliacao_comentario on public.avaliacoes;
create trigger contato_avaliacao_comentario before insert or update of comentario on public.avaliacoes
  for each row execute function public.bloqueia_contato_texto('comentario', 'rigoroso');
drop trigger if exists contato_imovel_titulo on public.properties;
create trigger contato_imovel_titulo before insert or update of title on public.properties
  for each row execute function public.bloqueia_contato_texto('title', 'anuncio');
drop trigger if exists contato_imovel_descricao on public.properties;
create trigger contato_imovel_descricao before insert or update of description on public.properties
  for each row execute function public.bloqueia_contato_texto('description', 'anuncio');
-- Perfil: só na EDIÇÃO do nome (o cadastro passa pelo handle_new_user, que não
-- pode falhar). Regra rigorosa: telefone no lugar do nome chegava no e-mail do lead.
drop trigger if exists contato_perfil_nome on public.profiles;
create trigger contato_perfil_nome before update of full_name on public.profiles
  for each row execute function public.bloqueia_contato_texto('full_name', 'rigoroso');

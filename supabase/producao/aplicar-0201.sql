-- Viva Nomads — aplicar 0201 (registro único de documentos, numeração e /conferir — Prompt 56). Idempotente. Rollback: supabase/producao/rollback/0201_rollback.sql.
begin;
set local lock_timeout = '5s';
-- Viva Nomads — 0201: registro único de documentos, numeração e /conferir (Prompt 56).
-- Idempotente. Produção: supabase/producao/aplicar-0201.sql (Action no merge). Rollback: supabase/producao/rollback/0201_rollback.sql.
--  1. proximo_numero_documento (0074) passa a numerar também os prefixos novos (PRV, CND, PRT, ENC, RPG, RSV, REG),
--     com 6 dígitos e o ano de Brasília. REC/CAU/DEV/INF seguem iguais; ORC continua no next_document_number (0008).
--     "RPS" (sigla oficial da NFS-e) nunca é prefixo da Viva.
--  2. documentos_registro: uma linha por documento (e por versão) gerado ou guardado pela plataforma. registro_seq é
--     uma sequência única, nunca reutilizada. Escrita só pelo servidor; leitura pelas partes do documento e pela equipe.
--     Nada é apagado; o status só vai de "valido" para "anulado" (com motivo) ou "substituido" (versão nova).
--  3. registrar_documento: a função única do servidor (registrarDocumento em src/lib/fiscal/registro.ts).
--  4. Backfill: documentos_fiscais, propostas, contratos e pedidos de parceiro existentes ganham a linha, pela ordem de
--     criação, sem mudar número, hash nem código já impressos. Contratos e pedidos novos entram por gatilho.
--  5. conferir_documento: só pelo código de verificação; devolve status, tipo, número, versão, data e hash. Sai o valor
--     e as iniciais das partes.
--  6. Conferências (35B): hash de fechamento gravado uma vez; depois dele nada muda (itens, respostas, laudos).
--     Correção vira versão nova (CND … v2) em conferencia_correcoes, com motivo.

-- ── 1. Numeração ────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.proximo_numero_documento(p_tipo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  prefixo text := case p_tipo
    when 'recibo_aluguel' then 'REC'
    when 'comprovante_caucao' then 'CAU'
    when 'termo_devolucao_caucao' then 'DEV'
    when 'informe_anual' then 'INF'
    when 'PRV' then 'PRV'
    when 'CND' then 'CND'
    when 'PRT' then 'PRT'
    when 'ENC' then 'ENC'
    when 'RPG' then 'RPG'
    when 'RSV' then 'RSV'
    when 'REG' then 'REG'
  end;
  a int := extract(year from now() at time zone 'America/Sao_Paulo');
  n int;
begin
  if prefixo is null then
    raise exception 'tipo de documento inválido: %', p_tipo using errcode = '22023';
  end if;
  insert into public.documentos_fiscais_contador (ano, tipo, ultimo) values (a, p_tipo, 1)
  on conflict (ano, tipo) do update set ultimo = documentos_fiscais_contador.ultimo + 1
  returning ultimo into n;
  return prefixo || '-' || a || '-' || lpad(n::text, 6, '0');
end;
$$;
revoke all on function public.proximo_numero_documento(text) from public, anon, authenticated;
grant execute on function public.proximo_numero_documento(text) to service_role;

-- ── 2. Registro ─────────────────────────────────────────────────────────────────────────────────────────────────
create sequence if not exists public.documentos_registro_seq as bigint;

create table if not exists public.documentos_registro (
  id uuid primary key default gen_random_uuid(),
  prefixo text not null check (prefixo in ('ORC', 'VN-CT', 'VN-SV', 'REC', 'RPG', 'RSV', 'CND', 'PRT', 'PRV', 'INF', 'ENC', 'CAU', 'DEV', 'REG', 'NFSE')),
  numero text not null check (char_length(numero) between 3 and 60 and numero !~* '^RPS'),
  registro_seq bigint not null unique default nextval('public.documentos_registro_seq'),
  versao int not null default 1 check (versao >= 1),
  tipo text not null check (char_length(tipo) between 2 and 60),
  ref_tabela text not null check (ref_tabela ~ '^[a-z_]{2,60}$'),
  ref_id uuid not null,
  hash_sha256 text check (hash_sha256 is null or hash_sha256 ~ '^[0-9a-f]{64}$'),
  codigo_verificacao text not null unique default encode(extensions.gen_random_bytes(16), 'hex')
    check (codigo_verificacao ~ '^[0-9a-f]{32}$'),
  status text not null default 'valido' check (status in ('valido', 'anulado', 'substituido')),
  anulado_motivo text,
  status_em timestamptz,
  emitido_em timestamptz not null default now(),
  emitido_por uuid references auth.users (id) on delete set null,
  partes uuid[] not null default '{}',
  is_teste boolean not null default false,
  -- NFS-e (da Viva ou do parceiro): sem número da Viva; guarda só o número oficial e o arquivo.
  numero_oficial text,
  arquivo_path text,
  check (status <> 'anulado' or char_length(btrim(coalesce(anulado_motivo, ''))) >= 5)
);
alter sequence public.documentos_registro_seq owned by public.documentos_registro.registro_seq;
-- Número + versão únicos, menos no VN-CT: ele vem dos 8 primeiros caracteres do id do contrato (legado, não muda) e
-- dois contratos podem coincidir; o que identifica cada um é o Registro nº. Nunca pode impedir um contrato de nascer.
create unique index if not exists documentos_registro_numero_versao on public.documentos_registro (prefixo, numero, versao)
  where prefixo <> 'VN-CT';
create index if not exists documentos_registro_ref on public.documentos_registro (ref_tabela, ref_id, prefixo, versao desc);
create index if not exists documentos_registro_partes on public.documentos_registro using gin (partes);
create index if not exists documentos_registro_emitido_por on public.documentos_registro (emitido_por);

comment on table public.documentos_registro is 'Registro único dos documentos da plataforma (Prompt 56): número, versão, hash, código. Só o servidor grava.';

alter table public.documentos_registro enable row level security;
revoke all on public.documentos_registro from anon, authenticated;
grant select on public.documentos_registro to authenticated;
grant all on public.documentos_registro to service_role;
revoke all on sequence public.documentos_registro_seq from public, anon, authenticated;
grant usage, select on sequence public.documentos_registro_seq to service_role;

drop policy if exists "partes e equipe leem o registro" on public.documentos_registro;
create policy "partes e equipe leem o registro" on public.documentos_registro
  for select to authenticated using ((select auth.uid()) = any (partes) or (select public.is_admin()));

-- Nada some e nada se reescreve: só o status anda (valido → anulado | substituido), uma vez.
create or replace function public.documentos_registro_imutavel() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Documento registrado não pode ser apagado.' using errcode = '42501';
  end if;
  if (new.id, new.prefixo, new.numero, new.registro_seq, new.versao, new.tipo, new.ref_tabela, new.ref_id, new.hash_sha256,
      new.codigo_verificacao, new.emitido_em, new.is_teste, new.numero_oficial, new.arquivo_path)
     is distinct from
     (old.id, old.prefixo, old.numero, old.registro_seq, old.versao, old.tipo, old.ref_tabela, old.ref_id, old.hash_sha256,
      old.codigo_verificacao, old.emitido_em, old.is_teste, old.numero_oficial, old.arquivo_path) then
    raise exception 'Documento registrado não muda: só o status.' using errcode = '42501';
  end if;
  -- Únicas exceções: quem emitiu vira nulo quando a conta some (FK) e uma parte pode sair de "partes".
  if new.emitido_por is distinct from old.emitido_por and new.emitido_por is not null then
    raise exception 'Quem emitiu não muda.' using errcode = '42501';
  end if;
  if not (new.partes <@ old.partes) then
    raise exception 'As partes do documento não mudam.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if old.status <> 'valido' then
      raise exception 'Documento % já está %.', old.numero, old.status using errcode = '42501';
    end if;
    new.status_em := now();
  elsif new.anulado_motivo is distinct from old.anulado_motivo or new.status_em is distinct from old.status_em then
    raise exception 'O status do documento só muda uma vez.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists documentos_registro_imutavel on public.documentos_registro;
create trigger documentos_registro_imutavel before update or delete on public.documentos_registro
  for each row execute function public.documentos_registro_imutavel();
revoke truncate on public.documentos_registro from public, anon, authenticated, service_role;

-- ── 3. Função única de registro ─────────────────────────────────────────────────────────────────────────────────
-- p_nova_versao: o documento já existe para esta referência (mesmo prefixo) → mesmo número, versão + 1, e a anterior
-- vira "substituido", na mesma transação. Sem p_nova_versao, é um documento novo (versão 1).
create or replace function public.registrar_documento(
  p_prefixo text,
  p_tipo text,
  p_numero text,
  p_ref_tabela text,
  p_ref_id uuid,
  p_hash text,
  p_codigo text,
  p_partes uuid[],
  p_is_teste boolean,
  p_emitido_por uuid default null,
  p_nova_versao boolean default false,
  p_versao int default null
) returns table (id uuid, numero text, versao int, registro_seq bigint, codigo_verificacao text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v int := 1;
  anterior record;
begin
  if p_prefixo = 'RPS' or p_numero ~* '^RPS' then
    raise exception 'RPS é a sigla oficial da NFS-e e não é prefixo da Viva.' using errcode = '22023';
  end if;
  if p_nova_versao then
    select r.numero, max(r.versao) as v into anterior
      from public.documentos_registro r
     where r.prefixo = p_prefixo and r.ref_tabela = p_ref_tabela and r.ref_id = p_ref_id
     group by r.numero
     order by max(r.versao) desc
     limit 1;
    if found then
      if anterior.numero is distinct from p_numero then
        raise exception 'A versão nova mantém o número % (veio %).', anterior.numero, p_numero using errcode = '22023';
      end if;
      -- A versão pode pular (a proposta que já tinha rodadas antes do registro entrou só como v1 no backfill),
      -- mas nunca repete nem volta.
      v := greatest(anterior.v + 1, coalesce(p_versao, 0));
      if p_versao is not null and p_versao <= anterior.v then
        raise exception 'A versão % já existe (a última é %).', p_versao, anterior.v using errcode = '40001';
      end if;
      update public.documentos_registro r set status = 'substituido'
       where r.prefixo = p_prefixo and r.ref_tabela = p_ref_tabela and r.ref_id = p_ref_id and r.status = 'valido';
    end if;
  elsif p_versao is not null then
    v := p_versao;
  end if;
  return query
    insert into public.documentos_registro as d
      (prefixo, numero, versao, tipo, ref_tabela, ref_id, hash_sha256, codigo_verificacao, partes, is_teste, emitido_por)
    values
      (p_prefixo, p_numero, v, p_tipo, p_ref_tabela, p_ref_id, p_hash,
       coalesce(p_codigo, encode(extensions.gen_random_bytes(16), 'hex')), coalesce(p_partes, '{}'), coalesce(p_is_teste, false), p_emitido_por)
    returning d.id, d.numero, d.versao, d.registro_seq, d.codigo_verificacao;
end;
$$;
revoke all on function public.registrar_documento(text, text, text, text, uuid, text, text, uuid[], boolean, uuid, boolean, int) from public, anon, authenticated;
grant execute on function public.registrar_documento(text, text, text, text, uuid, text, text, uuid[], boolean, uuid, boolean, int) to service_role;

create or replace function public.alguma_parte_teste(p_partes uuid[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(bool_or(p.is_teste), false) from public.profiles p where p.id = any (p_partes);
$$;
revoke all on function public.alguma_parte_teste(uuid[]) from public, anon, authenticated;
grant execute on function public.alguma_parte_teste(uuid[]) to service_role;

-- ── 4. Backfill (pela ordem de criação) e gatilhos de contrato/pedido ───────────────────────────────────────────
do $$
declare
  base bigint := coalesce((select max(registro_seq) from public.documentos_registro), 0);
begin
  with pendentes as (
    select split_part(d.numero, '-', 1) as prefixo, d.numero, d.tipo, 'documentos_fiscais' as ref_tabela, d.id as ref_id, d.hash as hash_sha256,
           d.codigo_verificacao, d.criado_em as emitido_em, array_remove(array[d.owner_id, d.tenant_id], null) as partes,
           case when d.anulado_em is not null then 'anulado' else 'valido' end as status, d.anulado_motivo, d.anulado_em as status_em
      from public.documentos_fiscais d
    union all
    select 'ORC', p.numero, 'proposta', 'propostas', p.id, null, encode(extensions.gen_random_bytes(16), 'hex'),
           p.criada_em, array_remove(array[p.owner_id, p.tenant_id], null), 'valido', null, null
      from public.propostas p
    union all
    select 'VN-CT', 'VN-CT-' || upper(left(c.id::text, 8)), 'contrato', 'contratos', c.id,
           (select a.hash_documento from public.contrato_assinaturas a where a.contrato_id = c.id order by a.assinado_em desc limit 1),
           encode(extensions.gen_random_bytes(16), 'hex'), c.created_at,
           array_remove(array[(select pr.owner_id from public.properties pr where pr.id = c.property_id), c.tenant_id], null),
           'valido', null, null
      from public.contratos c
    union all
    select 'VN-SV', s.codigo, 'pedido_parceiro', 'parceiro_pedidos', s.id, null, encode(extensions.gen_random_bytes(16), 'hex'),
           s.criado_em, array_remove(array[(select pa.user_id from public.parceiros pa where pa.id = s.parceiro_id), s.cliente_id], null),
           'valido', null, null
      from public.parceiro_pedidos s
  ), novos as (
    select x.*, row_number() over (order by x.emitido_em, x.ref_id) as ordem
      from pendentes x
     where not exists (select 1 from public.documentos_registro r where r.ref_tabela = x.ref_tabela and r.ref_id = x.ref_id)
  )
  insert into public.documentos_registro
    (prefixo, numero, registro_seq, versao, tipo, ref_tabela, ref_id, hash_sha256, codigo_verificacao, status, anulado_motivo,
     status_em, emitido_em, partes, is_teste)
  select n.prefixo, n.numero, base + n.ordem, 1,
         n.tipo,
         n.ref_tabela, n.ref_id, n.hash_sha256, n.codigo_verificacao, n.status, n.anulado_motivo, n.status_em, n.emitido_em,
         n.partes, public.alguma_parte_teste(n.partes)
    from novos n
   order by n.ordem;
end;
$$;
do $$ begin
  perform setval('public.documentos_registro_seq', greatest((select coalesce(max(registro_seq), 0) from public.documentos_registro), 1),
                 (select count(*) > 0 from public.documentos_registro));
end $$;

-- Contrato e pedido novos entram no registro na criação (VN-CT/VN-SV não mudam; ganham o "Registro nº").
create or replace function public.registrar_contrato_novo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ps uuid[];
begin
  ps := array_remove(array[(select pr.owner_id from public.properties pr where pr.id = new.property_id), new.tenant_id], null);
  insert into public.documentos_registro (prefixo, numero, tipo, ref_tabela, ref_id, partes, is_teste, emitido_em)
  select 'VN-CT', 'VN-CT-' || upper(left(new.id::text, 8)), 'contrato', 'contratos', new.id, ps, public.alguma_parte_teste(ps), new.created_at
   where not exists (select 1 from public.documentos_registro r where r.ref_tabela = 'contratos' and r.ref_id = new.id);
  return new;
end;
$$;
drop trigger if exists contratos_registro on public.contratos;
create trigger contratos_registro after insert on public.contratos for each row execute function public.registrar_contrato_novo();

create or replace function public.registrar_pedido_novo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ps uuid[];
begin
  ps := array_remove(array[(select pa.user_id from public.parceiros pa where pa.id = new.parceiro_id), new.cliente_id], null);
  insert into public.documentos_registro (prefixo, numero, tipo, ref_tabela, ref_id, partes, is_teste, emitido_em)
  select 'VN-SV', new.codigo, 'pedido_parceiro', 'parceiro_pedidos', new.id, ps, public.alguma_parte_teste(ps), new.criado_em
   where not exists (select 1 from public.documentos_registro r where r.ref_tabela = 'parceiro_pedidos' and r.ref_id = new.id);
  return new;
end;
$$;
drop trigger if exists parceiro_pedidos_registro on public.parceiro_pedidos;
create trigger parceiro_pedidos_registro after insert on public.parceiro_pedidos for each row execute function public.registrar_pedido_novo();

-- Anulação de documento fiscal (0083) segue para o registro.
create or replace function public.documentos_fiscais_anulacao_registro() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.anulado_em is not null and old.anulado_em is null then
    update public.documentos_registro set status = 'anulado', anulado_motivo = new.anulado_motivo
     where ref_tabela = 'documentos_fiscais' and ref_id = new.id and status = 'valido';
  end if;
  return new;
end;
$$;
drop trigger if exists documentos_fiscais_anulacao_registro on public.documentos_fiscais;
create trigger documentos_fiscais_anulacao_registro after update of anulado_em on public.documentos_fiscais
  for each row execute function public.documentos_fiscais_anulacao_registro();

-- ── 5. /conferir ────────────────────────────────────────────────────────────────────────────────────────────────
drop function if exists public.conferir_documento(text);
create function public.conferir_documento(p_codigo text)
returns table (prefixo text, tipo text, numero text, versao int, status text, anulado_motivo text, status_em timestamptz,
               emitido_em timestamptz, hash_sha256 text, is_teste boolean, registro_seq bigint, versao_vigente int)
language sql
stable
security definer
set search_path = public
as $$
  select r.prefixo, r.tipo, r.numero, r.versao, r.status, r.anulado_motivo, r.status_em, r.emitido_em, r.hash_sha256, r.is_teste,
         r.registro_seq,
         (select max(o.versao) from public.documentos_registro o
           where o.prefixo = r.prefixo and o.ref_tabela = r.ref_tabela and o.ref_id = r.ref_id and o.numero = r.numero)
    from public.documentos_registro r
   where p_codigo ~ '^[0-9a-f]{32}$' and r.codigo_verificacao = p_codigo
$$;
revoke all on function public.conferir_documento(text) from public;
grant execute on function public.conferir_documento(text) to anon, authenticated, service_role;

-- ── 6. Fechamento da conferência (35B) ──────────────────────────────────────────────────────────────────────────
alter table public.conferencias add column if not exists fechada_em timestamptz;
alter table public.conferencias add column if not exists fechamento_hash text;
alter table public.conferencias add column if not exists fechamento_motivo text;
alter table public.conferencias add column if not exists sem_resposta text[] not null default '{}';
do $c$ begin
  alter table public.conferencias add constraint conferencias_fechamento_hash check (fechamento_hash is null or fechamento_hash ~ '^[0-9a-f]{64}$');
exception when duplicate_object then null; end $c$;
do $c$ begin
  alter table public.conferencias add constraint conferencias_fechamento_motivo
    check (fechamento_motivo is null or fechamento_motivo in ('duas_respostas', 'janela_encerrada', 'encerramento_concluido'));
exception when duplicate_object then null; end $c$;
do $c$ begin
  alter table public.conferencias add constraint conferencias_fechamento_completo
    check ((fechada_em is null) = (fechamento_hash is null) and (fechada_em is null) = (fechamento_motivo is null));
exception when duplicate_object then null; end $c$;

-- Depois de fechada, a conferência não muda mais (nem pelo service_role).
create or replace function public.conferencias_fechamento_imutavel() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.fechada_em is not null and (new.fechada_em, new.fechamento_hash, new.fechamento_motivo, new.sem_resposta, new.tipo, new.contrato_id)
       is distinct from (old.fechada_em, old.fechamento_hash, old.fechamento_motivo, old.sem_resposta, old.tipo, old.contrato_id) then
    raise exception 'Conferência fechada não muda; a correção vira uma versão nova.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists conferencias_fechamento_imutavel on public.conferencias;
create trigger conferencias_fechamento_imutavel before update on public.conferencias
  for each row execute function public.conferencias_fechamento_imutavel();

create or replace function public.conferencia_fechada_trava() returns trigger
language plpgsql set search_path = public as $$
declare
  cid uuid := coalesce(new.conferencia_id, old.conferencia_id);
begin
  -- A cascada do contrato apagado (conferência → itens/respostas/laudos) passa.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  if exists (select 1 from public.conferencias c where c.id = cid and c.fechada_em is not null) then
    raise exception 'Conferência fechada: nada muda depois do fechamento.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists conferencia_itens_fechada on public.conferencia_itens;
create trigger conferencia_itens_fechada before insert or update or delete on public.conferencia_itens
  for each row execute function public.conferencia_fechada_trava();
drop trigger if exists conferencia_respostas_fechada on public.conferencia_respostas;
create trigger conferencia_respostas_fechada before insert or update or delete on public.conferencia_respostas
  for each row execute function public.conferencia_fechada_trava();
do $$ begin
  if to_regclass('public.conferencia_laudos') is not null then
    execute 'drop trigger if exists conferencia_laudos_fechada on public.conferencia_laudos';
    execute 'create trigger conferencia_laudos_fechada before insert or update or delete on public.conferencia_laudos
               for each row execute function public.conferencia_fechada_trava()';
  end if;
end $$;

-- Fecha uma vez só. Devolve false se já estava fechada (idempotente para a rotina e para a segunda resposta).
create or replace function public.fechar_conferencia(p_id uuid, p_hash text, p_motivo text, p_sem_resposta text[] default '{}')
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.conferencias set fechada_em = now(), fechamento_hash = p_hash, fechamento_motivo = p_motivo,
         sem_resposta = coalesce(p_sem_resposta, '{}')
   where id = p_id and fechada_em is null;
  return found;
end;
$$;
revoke all on function public.fechar_conferencia(uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function public.fechar_conferencia(uuid, text, text, text[]) to service_role;

-- Correção depois do fechamento: versão nova (CND … v2, v3…) com motivo; o fechamento original fica como está.
create table if not exists public.conferencia_correcoes (
  id uuid primary key default gen_random_uuid(),
  conferencia_id uuid not null references public.conferencias (id) on delete cascade,
  versao int not null check (versao >= 2),
  motivo text not null check (char_length(btrim(motivo)) between 5 and 500),
  texto text not null check (char_length(btrim(texto)) between 1 and 4000),
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (conferencia_id, versao)
);
create index if not exists conferencia_correcoes_criado_por on public.conferencia_correcoes (criado_por);
alter table public.conferencia_correcoes enable row level security;
revoke all on public.conferencia_correcoes from anon, authenticated;
grant select on public.conferencia_correcoes to authenticated;
grant all on public.conferencia_correcoes to service_role;
drop policy if exists "partes e equipe leem as correções" on public.conferencia_correcoes;
create policy "partes e equipe leem as correções" on public.conferencia_correcoes
  for select to authenticated using (
    (select public.is_admin()) or exists (
      select 1 from public.conferencias c join public.contratos k on k.id = c.contrato_id
        join public.properties p on p.id = k.property_id
       where c.id = conferencia_correcoes.conferencia_id and (select auth.uid()) in (k.tenant_id, p.owner_id)
    )
  );
create or replace function public.conferencia_correcoes_imutavel() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Só a cascata do contrato apagado passa.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'A correção da conferência não muda nem some.' using errcode = '42501';
end;
$$;
drop trigger if exists conferencia_correcoes_imutavel on public.conferencia_correcoes;
create trigger conferencia_correcoes_imutavel before update or delete on public.conferencia_correcoes
  for each row execute function public.conferencia_correcoes_imutavel();

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261021000201', '0201_documentos_registro',
       array['-- conteúdo em supabase/migrations/0201_documentos_registro.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261021000201');
commit;

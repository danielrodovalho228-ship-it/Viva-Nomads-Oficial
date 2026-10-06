-- 0074 — Documentos fiscais da plataforma (PR F1) + base da NFS-e (F2/F3).
--
-- Regra: a Viva Nomads só emite NOTA do que ela vende (assinatura, comissão) —
-- isso fica em public.invoices. Aqui ficam os documentos que a plataforma GERA
-- para as partes: recibo de aluguel (do proprietário), comprovante e termo de
-- devolução da caução, informe anual do inquilino. Nunca "nota fiscal".
--
-- Retenção: o documento é um RETRATO do momento da emissão (nomes, CPF/CNPJ,
-- endereço). Excluir/anonimizar uma conta apaga em cascata contratos,
-- pagamentos e acertos — por isso TODAS as ligações aqui são "on delete set
-- null": o documento fica guardado (obrigação legal) e a exclusão não trava.
-- Reaplicar é seguro (idempotente).

-- 1) Iniciais para a conferência pública (criada ANTES de quem a usa).
create or replace function public.iniciais(n text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(string_agg(left(p, 1) || '.', ' '), '—')
  from unnest(string_to_array(trim(coalesce(n, '')), ' ')) as p
  where p <> ''
$$;

-- 2) Documentos (escrita só pelo servidor; leitura pelas partes).
create table if not exists public.documentos_fiscais (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('recibo_aluguel', 'comprovante_caucao', 'termo_devolucao_caucao', 'informe_anual')),
  numero text not null unique,                        -- REC-2026-000001 / CAU-… / DEV-… / INF-…
  ano int not null check (ano between 2020 and 2100),
  contrato_id uuid references public.contratos (id) on delete set null,
  pagamento_id uuid references public.pagamentos_bloco (id) on delete set null,
  acerto_id uuid references public.caucao_acertos (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  tenant_id uuid references public.profiles (id) on delete set null,
  -- Retrato no momento da emissão (o PDF e a conferência usam ISTO, nunca o perfil atual).
  locador_nome text,
  locador_doc text,                                   -- CPF/CNPJ do proprietário
  locatario_nome text,
  locatario_doc text,                                 -- CPF/CNPJ do inquilino
  imovel_endereco text,
  contrato_ref text,                                  -- referência do contrato no momento da emissão
  periodo_inicio date,
  periodo_fim date,
  valor numeric(12, 2) not null check (valor >= 0),
  encargos jsonb not null default '[]'::jsonb check (jsonb_typeof(encargos) = 'array'),
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),  -- sha256 do PDF
  -- 32 hex = 128 bits aleatórios; nunca sequencial, nunca vindo do app.
  codigo_verificacao text not null unique default encode(extensions.gen_random_bytes(16), 'hex')
    check (codigo_verificacao ~ '^[0-9a-f]{32}$'),
  pdf_path text not null,                             -- bucket privado "documentos"
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (tipo, pagamento_id),
  unique (tipo, acerto_id)
);
create index if not exists documentos_fiscais_contrato_idx on public.documentos_fiscais (contrato_id);
create index if not exists documentos_fiscais_owner_idx on public.documentos_fiscais (owner_id);
create index if not exists documentos_fiscais_tenant_idx on public.documentos_fiscais (tenant_id);
-- Informe anual: um por inquilino por ano.
create unique index if not exists documentos_fiscais_informe_unico
  on public.documentos_fiscais (tenant_id, ano) where tipo = 'informe_anual';

-- Regras de EMISSÃO (no insert; depois a exclusão de conta pode zerar as ligações).
create or replace function public.documentos_fiscais_emissao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tenant_id is null or new.locatario_nome is null then
    raise exception 'documento sem inquilino' using errcode = '23514';
  end if;
  if new.tipo <> 'informe_anual' then
    if new.contrato_id is null or new.owner_id is null or new.locador_nome is null or new.imovel_endereco is null then
      raise exception 'documento de contrato sem contrato, proprietário ou endereço' using errcode = '23514';
    end if;
  end if;
  if new.tipo in ('recibo_aluguel', 'comprovante_caucao') and new.pagamento_id is null then
    raise exception 'recibo/comprovante sem pagamento' using errcode = '23514';
  end if;
  if new.tipo = 'termo_devolucao_caucao' and new.acerto_id is null then
    raise exception 'termo de devolução sem acerto' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists documentos_fiscais_emissao on public.documentos_fiscais;
create trigger documentos_fiscais_emissao before insert on public.documentos_fiscais
  for each row execute function public.documentos_fiscais_emissao();

-- Documento emitido não muda: só "enviado_em" e as ligações virando null (exclusão de conta).
create or replace function public.documentos_fiscais_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - array['enviado_em', 'contrato_id', 'pagamento_id', 'acerto_id', 'owner_id', 'tenant_id'])
     is distinct from (to_jsonb(old) - array['enviado_em', 'contrato_id', 'pagamento_id', 'acerto_id', 'owner_id', 'tenant_id'])
     or (new.contrato_id is not null and new.contrato_id is distinct from old.contrato_id)
     or (new.pagamento_id is not null and new.pagamento_id is distinct from old.pagamento_id)
     or (new.acerto_id is not null and new.acerto_id is distinct from old.acerto_id)
     or (new.owner_id is not null and new.owner_id is distinct from old.owner_id)
     or (new.tenant_id is not null and new.tenant_id is distinct from old.tenant_id)
  then
    raise exception 'documento emitido não pode ser alterado' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists documentos_fiscais_imutavel on public.documentos_fiscais;
create trigger documentos_fiscais_imutavel before update on public.documentos_fiscais
  for each row execute function public.documentos_fiscais_imutavel();

alter table public.documentos_fiscais enable row level security;
revoke all on public.documentos_fiscais from anon, authenticated;
grant select on public.documentos_fiscais to authenticated;
grant all on public.documentos_fiscais to service_role;
drop policy if exists "partes veem os próprios documentos" on public.documentos_fiscais;
create policy "partes veem os próprios documentos" on public.documentos_fiscais
  for select using (owner_id = auth.uid() or tenant_id = auth.uid() or public.is_admin());

-- 3) Conferência pública: só número, tipo, data, valor, período e INICIAIS do retrato.
--    Sem CPF, e-mail, telefone ou endereço. Código fora do formato → nada.
--    (Limite de tentativas por IP fica na rota pública: 20 por hora.)
create or replace function public.conferir_documento(p_codigo text)
returns table (numero text, tipo text, valor numeric, emitido_em timestamptz, periodo_inicio date, periodo_fim date, locador text, locatario text)
language sql
stable
security definer
set search_path = public
as $$
  select d.numero, d.tipo, d.valor, d.criado_em, d.periodo_inicio, d.periodo_fim,
         public.iniciais(d.locador_nome), public.iniciais(d.locatario_nome)
  from public.documentos_fiscais d
  where p_codigo ~ '^[0-9a-f]{32}$' and d.codigo_verificacao = p_codigo
$$;
revoke all on function public.conferir_documento(text) from public;
grant execute on function public.conferir_documento(text) to anon, authenticated, service_role;

-- 4) Numeração sequencial por tipo e ano (sem buraco nem repetição). Tipo fora da lista = erro.
create table if not exists public.documentos_fiscais_contador (
  ano int not null,
  tipo text not null,
  ultimo int not null default 0,
  primary key (ano, tipo)
);
alter table public.documentos_fiscais_contador enable row level security;
revoke all on public.documentos_fiscais_contador from anon, authenticated;
grant all on public.documentos_fiscais_contador to service_role;

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

-- 5) Encargos do pagamento (condomínio, IPTU, contas) — lista [{rotulo, valor}].
alter table public.pagamentos_bloco add column if not exists encargos jsonb not null default '[]'::jsonb;
do $c$ begin
  alter table public.pagamentos_bloco add constraint pagamentos_bloco_encargos_lista check (jsonb_typeof(encargos) = 'array');
exception when duplicate_object then null; end $c$;

-- 6) E-mail do contador do proprietário. GRAVADO só pelo servidor (server action
--    que confere o dono): authenticated tem UPDATE só nas colunas listadas, e
--    esta não entra. Leitura: o RLS de profiles já limita à própria linha (e ao
--    admin). Nunca aparece em tela pública.
alter table public.profiles add column if not exists email_contador text;
do $c$ begin
  alter table public.profiles add constraint profiles_email_contador_formato
    check (email_contador is null or (length(email_contador) <= 254 and email_contador ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
exception when duplicate_object then null; end $c$;

-- 7) Número da NFS-e da Viva (PR F2).
do $c$ begin
  if to_regclass('public.invoices') is not null then
    alter table public.invoices add column if not exists numero text;
  end if;
end $c$;

-- 8) Bucket PRIVADO dos PDFs. Sem política em storage.objects para anon/authenticated:
--    download só por URL assinada (10 min) gerada no servidor após checar a parte.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 2097152, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 9) Fora do escopo, mas certo: ninguém da API trunca tabela.
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate on tables from anon, authenticated;

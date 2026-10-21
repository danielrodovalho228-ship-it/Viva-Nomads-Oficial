-- Viva Nomads — 0198: página da estadia (Prompt 32).
-- Instruções de chegada do imóvel (restritas), ocupantes do contrato (lista da portaria), notas privadas,
-- aditivos (proposta → aceite → assinatura das duas partes com código) e pedidos de encerramento.
-- Nenhum dinheiro passa pela Viva: a taxa de serviço do aditivo é só registro para o fluxo de cobrança que já existe.

-- Quem é parte do contrato (o morador ou o dono do imóvel). Security definer: a política não depende de o
-- imóvel estar publicado nem das colunas de contratos que o morador lê (0177).
create or replace function public.eh_parte_do_contrato(p_contrato uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contratos c join public.properties p on p.id = c.property_id
     where c.id = p_contrato and auth.uid() is not null and (c.tenant_id = auth.uid() or p.owner_id = auth.uid())
  );
$$;
revoke all on function public.eh_parte_do_contrato(uuid) from public, anon;
grant execute on function public.eh_parte_do_contrato(uuid) to authenticated, service_role;

-- ── 1. Instruções de chegada (uma por imóvel; nunca na API pública nem na página do imóvel) ────────────────────
create table if not exists public.imovel_instrucoes_chegada (
  property_id uuid primary key references public.properties(id) on delete cascade,
  como_entrar text check (como_entrar is null or char_length(como_entrar) <= 1000),
  wifi_rede text check (wifi_rede is null or char_length(wifi_rede) <= 100),
  wifi_senha text check (wifi_senha is null or char_length(wifi_senha) <= 100),
  regras_condominio text check (regras_condominio is null or char_length(regras_condominio) <= 1500),
  lixo text check (lixo is null or char_length(lixo) <= 500),
  vaga text check (vaga is null or char_length(vaga) <= 500),
  contatos_predio text check (contatos_predio is null or char_length(contatos_predio) <= 500),
  observacoes text check (observacoes is null or char_length(observacoes) <= 1500),
  atualizado_em timestamptz not null default now()
);
comment on table public.imovel_instrucoes_chegada is
  'Prompt 32: instruções de chegada. Só o dono lê e grava; o morador recebe pelo servidor, liberadas 7 dias antes da entrada com o contrato assinado pelas duas partes e o 1º pagamento registrado.';
alter table public.imovel_instrucoes_chegada enable row level security;
revoke all on public.imovel_instrucoes_chegada from anon, authenticated;
grant select, insert, update on public.imovel_instrucoes_chegada to authenticated;
grant all on public.imovel_instrucoes_chegada to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'imovel_instrucoes_chegada' and policyname = 'instrucoes: só o dono') then
    create policy "instrucoes: só o dono" on public.imovel_instrucoes_chegada for all to authenticated
      using (exists (select 1 from public.properties p where p.id = imovel_instrucoes_chegada.property_id and p.owner_id = auth.uid()))
      with check (exists (select 1 from public.properties p where p.id = imovel_instrucoes_chegada.property_id and p.owner_id = auth.uid()));
  end if;
end;
$$;

-- ── 2. Ocupantes (lista para a portaria) ────────────────────────────────────────────────────────────────────────
create table if not exists public.contrato_ocupantes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  documento text not null check (char_length(btrim(documento)) between 5 and 30),
  parentesco_ou_relacao text check (parentesco_ou_relacao is null or char_length(parentesco_ou_relacao) <= 60),
  criado_por uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists contrato_ocupantes_contrato on public.contrato_ocupantes (contrato_id);
comment on column public.contrato_ocupantes.documento is
  'Restrito: só as partes do contrato e a equipe. Apagado 90 dias depois do fim do contrato (rotina das automações).';
alter table public.contrato_ocupantes enable row level security;
revoke all on public.contrato_ocupantes from anon, authenticated;
grant select on public.contrato_ocupantes to authenticated;
grant all on public.contrato_ocupantes to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contrato_ocupantes' and policyname = 'ocupantes: partes e equipe') then
    create policy "ocupantes: partes e equipe" on public.contrato_ocupantes for select to authenticated using (
      public.is_admin() or public.eh_parte_do_contrato(contrato_ocupantes.contrato_id)
    );
  end if;
end;
$$;

-- Teto no banco: nunca mais ocupantes que qtd_ocupantes do contrato (o servidor confere antes; isto é a rede).
create or replace function public.contrato_ocupantes_teto() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  teto integer;
  atuais integer;
begin
  select coalesce(qtd_ocupantes, 1) into teto from public.contratos where id = new.contrato_id;
  select count(*) into atuais from public.contrato_ocupantes where contrato_id = new.contrato_id;
  if atuais >= teto then
    raise exception 'ocupantes acima do limite do contrato (%)', teto using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.contrato_ocupantes_teto() from public;
drop trigger if exists contrato_ocupantes_teto on public.contrato_ocupantes;
create trigger contrato_ocupantes_teto before insert on public.contrato_ocupantes
  for each row execute function public.contrato_ocupantes_teto();

-- ── 3. Notas privadas (uma por contrato e por autor, só o autor lê) ────────────────────────────────────────────
create table if not exists public.contrato_notas (
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  texto text not null default '' check (char_length(texto) <= 2000),
  atualizado_em timestamptz not null default now(),
  primary key (contrato_id, autor_id)
);
alter table public.contrato_notas enable row level security;
revoke all on public.contrato_notas from anon, authenticated;
grant select, insert, update, delete on public.contrato_notas to authenticated;
grant all on public.contrato_notas to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contrato_notas' and policyname = 'notas: só o autor, que é parte') then
    create policy "notas: só o autor, que é parte" on public.contrato_notas for all to authenticated
      using (autor_id = auth.uid())
      with check (autor_id = auth.uid() and public.eh_parte_do_contrato(contrato_notas.contrato_id));
  end if;
end;
$$;

-- ── 4. Aditivos (proposta → aceite → assinatura das duas partes) ───────────────────────────────────────────────
create table if not exists public.contrato_aditivos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  numero integer not null check (numero >= 1),
  proposto_por uuid not null references auth.users(id),
  papel_proponente text not null check (papel_proponente in ('proprietario', 'inquilino')),
  mudancas jsonb not null,
  resumo text not null check (char_length(resumo) <= 2000),
  status text not null default 'proposto' check (status in ('proposto', 'recusado', 'expirado', 'aceito', 'assinado')),
  expira_em timestamptz not null,
  respondido_em timestamptz,
  hash_documento text,
  assinado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (contrato_id, numero)
);
create index if not exists contrato_aditivos_contrato on public.contrato_aditivos (contrato_id, numero);
create unique index if not exists contrato_aditivos_um_aberto on public.contrato_aditivos (contrato_id)
  where status in ('proposto', 'aceito');
comment on table public.contrato_aditivos is
  'Prompt 32: só registra o que mudou (antes e depois). Sem cláusula nova de multa ou devolução até o parecer jurídico. Blocos e datas só mudam com as duas assinaturas.';
alter table public.contrato_aditivos enable row level security;
revoke all on public.contrato_aditivos from anon, authenticated;
grant select on public.contrato_aditivos to authenticated;
grant all on public.contrato_aditivos to service_role;

-- A taxa de serviço do aditivo fica fora da tabela que o morador lê (como na 0177).
create table if not exists public.contrato_aditivo_taxa (
  aditivo_id uuid primary key references public.contrato_aditivos(id) on delete cascade,
  valor numeric(10, 2) not null,
  percentual numeric(5, 4) not null,
  base_texto text not null,
  registrado_em timestamptz not null default now()
);
comment on column public.contrato_aditivo_taxa.valor is 'Positivo = cobrança a mais; negativo = abatimento. Só registro: a cobrança usa o fluxo da taxa que já existe.';
alter table public.contrato_aditivo_taxa enable row level security;
revoke all on public.contrato_aditivo_taxa from anon, authenticated;
grant all on public.contrato_aditivo_taxa to service_role;

create table if not exists public.contrato_aditivo_assinaturas (
  aditivo_id uuid not null references public.contrato_aditivos(id) on delete cascade,
  papel text not null check (papel in ('proprietario', 'inquilino')),
  user_id uuid not null references auth.users(id),
  assinado_em timestamptz not null default now(),
  ip text,
  hash_documento text not null,
  primary key (aditivo_id, papel)
);
alter table public.contrato_aditivo_assinaturas enable row level security;
revoke all on public.contrato_aditivo_assinaturas from anon, authenticated;
grant select on public.contrato_aditivo_assinaturas to authenticated;
grant all on public.contrato_aditivo_assinaturas to service_role;

create table if not exists public.contrato_aditivo_codigos (
  aditivo_id uuid not null references public.contrato_aditivos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo_hash text not null,
  expira_em timestamptz not null,
  falhas integer not null default 0,
  usado_em timestamptz,
  enviado_em timestamptz not null default now(),
  primary key (aditivo_id, user_id)
);
alter table public.contrato_aditivo_codigos enable row level security;
revoke all on public.contrato_aditivo_codigos from anon, authenticated;
grant all on public.contrato_aditivo_codigos to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contrato_aditivos' and policyname = 'aditivos: partes e equipe') then
    create policy "aditivos: partes e equipe" on public.contrato_aditivos for select to authenticated using (
      public.is_admin() or public.eh_parte_do_contrato(contrato_aditivos.contrato_id)
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contrato_aditivo_assinaturas' and policyname = 'assinaturas do aditivo: partes e equipe') then
    create policy "assinaturas do aditivo: partes e equipe" on public.contrato_aditivo_assinaturas for select to authenticated using (
      exists (select 1 from public.contrato_aditivos a where a.id = contrato_aditivo_assinaturas.aditivo_id)
    );
  end if;
end;
$$;

-- ── 5. Pedidos de encerramento (regras desligadas: a Viva conduz com as partes) ────────────────────────────────
create table if not exists public.contrato_encerramento_pedidos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  pedido_por uuid not null references auth.users(id),
  papel text not null check (papel in ('proprietario', 'inquilino')),
  motivo text not null check (motivo in ('mudanca_planos_morador', 'imovel_indisponivel', 'problema_no_imovel', 'acordo_entre_partes', 'outro')),
  texto text check (texto is null or char_length(texto) <= 1000),
  status text not null default 'aberto' check (status in ('aberto', 'em_conducao', 'concluido')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (motivo <> 'outro' or char_length(btrim(coalesce(texto, ''))) >= 5)
);
create index if not exists contrato_encerramento_abertos on public.contrato_encerramento_pedidos (status, criado_em desc);
create unique index if not exists contrato_encerramento_um_aberto on public.contrato_encerramento_pedidos (contrato_id)
  where status <> 'concluido';
alter table public.contrato_encerramento_pedidos enable row level security;
revoke all on public.contrato_encerramento_pedidos from anon, authenticated;
grant select on public.contrato_encerramento_pedidos to authenticated;
grant all on public.contrato_encerramento_pedidos to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contrato_encerramento_pedidos' and policyname = 'encerramento: partes e equipe') then
    create policy "encerramento: partes e equipe" on public.contrato_encerramento_pedidos for select to authenticated using (
      public.is_admin() or public.eh_parte_do_contrato(contrato_encerramento_pedidos.contrato_id)
    );
  end if;
end;
$$;

-- ── 6. Eventos do contrato (o Prompt 38 lê: "estadia_remarcada" atualiza e "contrato_encerrado" cancela os pedidos
--       automáticos). Só o servidor grava e lê.
create table if not exists public.contrato_eventos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  tipo text not null check (tipo in ('aditivo_proposto', 'aditivo_aceito', 'aditivo_recusado', 'aditivo_expirado', 'estadia_remarcada',
                                     'encerramento_pedido', 'contrato_encerrado', 'instrucoes_liberadas', 'ocupantes_apagados')),
  autor_id uuid references auth.users(id) on delete set null,
  dados jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index if not exists contrato_eventos_contrato on public.contrato_eventos (contrato_id, criado_em);
create index if not exists contrato_eventos_tipo on public.contrato_eventos (tipo, criado_em);
alter table public.contrato_eventos enable row level security;
revoke all on public.contrato_eventos from anon, authenticated;
grant all on public.contrato_eventos to service_role;

-- ── 7. Aplicar o aditivo nos blocos, tudo ou nada ──────────────────────────────────────────────────────────────
-- Só com as duas assinaturas (o servidor confere). Marca o aditivo como assinado, atualiza no lugar os blocos não
-- iniciados que continuam (mesmo número), cria os que faltam (com os dois aceites: o aditivo assinado) e apaga os que
-- sobram — nunca um bloco com pagamento registrado (a FK apagaria o pagamento): nesse caso nada muda.
create or replace function public.aplicar_aditivo(
  p_aditivo uuid, p_refazer uuid[], p_novos jsonb, p_prazo_dias integer, p_qtd integer, p_valor numeric
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_contrato uuid;
  v_forma text;
  x record;
begin
  update public.contrato_aditivos set status = 'assinado', assinado_em = now()
   where id = p_aditivo and status = 'aceito'
  returning contrato_id into v_contrato;
  if v_contrato is null then
    return false;
  end if;
  select coalesce(min(caucao_forma), 'avista') into v_forma from public.contrato_blocos where contrato_id = v_contrato;
  if exists (
    select 1 from public.pagamentos_bloco pg join public.contrato_blocos b on b.id = pg.bloco_id
     where b.id = any(p_refazer)
       and b.numero_bloco not in (select (j->>'numero_bloco')::int from jsonb_array_elements(p_novos) j)
  ) then
    raise exception 'bloco com pagamento registrado não sai por aditivo' using errcode = 'check_violation';
  end if;
  delete from public.contrato_blocos b
   where b.id = any(p_refazer)
     and b.numero_bloco not in (select (j->>'numero_bloco')::int from jsonb_array_elements(p_novos) j);
  for x in select * from jsonb_to_recordset(p_novos) as r(numero_bloco int, inicio date, fim date, meses int, valor numeric, caucao numeric, status text)
  loop
    update public.contrato_blocos
       set inicio = x.inicio, fim = x.fim, meses = x.meses, valor = x.valor, caucao = x.caucao,
           aceite_proprietario_em = coalesce(aceite_proprietario_em, now()), aceite_inquilino_em = coalesce(aceite_inquilino_em, now()),
           status = case when status in ('pendente_aceite', 'agendado') and x.numero_bloco > 1 then 'agendado' else status end
     where contrato_id = v_contrato and numero_bloco = x.numero_bloco and id = any(p_refazer);
    if not found then
      insert into public.contrato_blocos (contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, caucao_forma, status, aceite_proprietario_em, aceite_inquilino_em)
      values (v_contrato, x.numero_bloco, x.inicio, x.fim, x.meses, x.valor, x.caucao, v_forma, x.status, now(), now());
    end if;
  end loop;
  update public.contratos
     set prazo_total_dias = p_prazo_dias,
         qtd_ocupantes = coalesce(p_qtd, qtd_ocupantes),
         aluguel_mensal = coalesce(p_valor, aluguel_mensal)
   where id = v_contrato;
  return true;
end;
$$;
revoke all on function public.aplicar_aditivo(uuid, uuid[], jsonb, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.aplicar_aditivo(uuid, uuid[], jsonb, integer, integer, numeric) to service_role;

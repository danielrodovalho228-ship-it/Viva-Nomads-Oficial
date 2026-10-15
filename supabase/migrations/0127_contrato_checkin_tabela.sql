-- Viva Nomads — 0127: instruções de entrada em tabela PRÓPRIA, só do servidor (achado do Moacir no #513; ordem 404cd213, item 2).
-- Na 0126 as colunas ficaram em public.contratos, e a política "contrato visível às partes" deixava o inquilino
-- ler o telefone de plantão pela API antes das duas assinaturas. Aqui: RLS ligada, sem política, sem permissão
-- para anon/authenticated (só service_role, depois de o servidor conferir a parte). Também guarda os lembretes
-- 48 h e 24 h já enviados (um por contrato, nunca repete). Rollback: supabase/producao/rollback/0127_rollback.sql.
create table if not exists public.contratos_checkin (
  contrato_id uuid primary key references public.contratos(id) on delete cascade,
  horario text check (horario is null or horario ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  instrucoes text check (instrucoes is null or char_length(instrucoes) <= 600),
  plantao text check (plantao is null or plantao ~ '^[0-9]{10,13}$'),
  atualizado_em timestamptz,
  lembrete_48h_em timestamptz,
  lembrete_24h_em timestamptz
);

alter table public.contratos_checkin enable row level security;
revoke all on public.contratos_checkin from anon, authenticated;
comment on table public.contratos_checkin is 'Instruções de entrada (horário, chave/acesso, plantão) e lembretes 48h/24h. Só service_role.';

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'contratos' and column_name = 'checkin_plantao') then
    insert into public.contratos_checkin (contrato_id, horario, instrucoes, plantao, atualizado_em)
    select id, checkin_horario, checkin_instrucoes, checkin_plantao, checkin_atualizado_em
      from public.contratos
     where checkin_horario is not null or checkin_instrucoes is not null or checkin_plantao is not null
    on conflict (contrato_id) do nothing;
  end if;
end $$;

alter table public.contratos
  drop constraint if exists contratos_checkin_horario_fmt,
  drop constraint if exists contratos_checkin_instrucoes_len,
  drop constraint if exists contratos_checkin_plantao_fmt,
  drop column if exists checkin_horario,
  drop column if exists checkin_instrucoes,
  drop column if exists checkin_plantao,
  drop column if exists checkin_atualizado_em;

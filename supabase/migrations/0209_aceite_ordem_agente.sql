-- 0209 — ACEITE do Daniel nas ORDENS DOS AGENTES (ordem 3c3d8a9e, parte 2; pedido do Rogério, aprovado pelo Daniel 12/10/2026).
-- Ordem criada por uma pessoa na Central (criado_por preenchido) só é "feita" quando QUEM PEDIU aceita. Ordem de agente
-- (criado_por nulo) não muda. Sem novo valor de status: "aguardando seu aceite" = status 'concluida' + criado_por + aceito_em nulo
-- (assim registrar_ronda e as contagens existentes seguem iguais).
--  • Colunas aceito_por / aceito_em / reaberto_em / reaberto_motivo.
--  • As ordens JÁ concluídas antes desta regra ficam como aceitas (aceito_em = última atualização, aceito_por nulo), só na 1ª aplicação.
--  • Gatilho: com usuário logado, só o criador da ordem muda aceito_* / reaberto_* (service role, usado pelos agentes, passa).
-- Sem dado pessoal novo. Idempotente; reaplicar não muda nada.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'agentes_ordens' and column_name = 'aceito_em'
  ) then
    alter table public.agentes_ordens add column aceito_em timestamptz;
    update public.agentes_ordens
       set aceito_em = coalesce(atualizada_em, criada_em)
     where status = 'concluida' and criado_por is not null;
  end if;
end;
$$;

alter table public.agentes_ordens add column if not exists aceito_por uuid references public.profiles(id) on delete set null;
alter table public.agentes_ordens add column if not exists reaberto_em timestamptz;
alter table public.agentes_ordens add column if not exists reaberto_motivo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.agentes_ordens'::regclass and conname = 'agentes_ordens_reaberto_motivo_tam') then
    alter table public.agentes_ordens add constraint agentes_ordens_reaberto_motivo_tam
      check (reaberto_motivo is null or char_length(reaberto_motivo) <= 1000);
  end if;
end;
$$;

create index if not exists agentes_ordens_aguardando_aceite on public.agentes_ordens (criado_por) where status = 'concluida' and aceito_em is null;
create index if not exists idx_agentes_ordens_aceito_por on public.agentes_ordens (aceito_por);

-- Só quem criou a ordem aceita ou reabre. Mudança sem usuário logado (service role: os agentes) passa.
create or replace function public.agentes_ordens_aceite_so_criador()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.aceito_em is distinct from old.aceito_em or new.aceito_por is distinct from old.aceito_por
      or new.reaberto_em is distinct from old.reaberto_em or new.reaberto_motivo is distinct from old.reaberto_motivo)
     and auth.uid() is not null and auth.uid() is distinct from old.criado_por then
    raise exception 'Só quem criou a ordem aceita ou reabre.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists agentes_ordens_aceite_so_criador on public.agentes_ordens;
create trigger agentes_ordens_aceite_so_criador before update on public.agentes_ordens
  for each row execute function public.agentes_ordens_aceite_so_criador();

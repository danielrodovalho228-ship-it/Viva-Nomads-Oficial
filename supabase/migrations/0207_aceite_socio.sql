-- 0207 — ACEITE DO SÓCIO na Caixa dos Sócios (ordem 3c3d8a9e, parte 1; pedido do Rogério, aprovado pelo Daniel 12/10/2026).
-- Nenhum pedido de sócio é "feito" sem o aceite de quem pediu. Novo status 'aguardando_aceite': o Moacir entrega e o AUTOR do
-- pedido aceita (vira 'feito', grava quem e quando) ou reabre com o que falta (volta a 'em_andamento'; o texto vai para o Moacir).
--  • CHECK do status ganha 'aguardando_aceite'; colunas aceito_por/aceito_em/reaberto_em/reaberto_motivo.
--  • Gatilho: só o autor tira o item de 'aguardando_aceite' quando a mudança vem de um usuário logado (o Moacir usa service role).
--  • responder_caixa_socios: aceita 'aguardando_aceite' e converte 'feito' em 'aguardando_aceite' (ninguém "fecha" pelo sócio).
--  • caixa_socios_pendentes: passa a devolver também o item reaberto, com o motivo.
-- Sem dado pessoal novo. Idempotente; reaplicar não muda nada.

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.caixa_socios'::regclass and conname = 'caixa_socios_status_check'
       and pg_get_constraintdef(oid) not like '%aguardando_aceite%'
  ) then
    alter table public.caixa_socios drop constraint caixa_socios_status_check;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.caixa_socios'::regclass and conname = 'caixa_socios_status_check') then
    alter table public.caixa_socios add constraint caixa_socios_status_check
      check (status in ('novo','em_andamento','feito','precisa_daniel','aguardando_aceite'));
  end if;
end;
$$;

alter table public.caixa_socios add column if not exists aceito_por uuid references public.profiles(id) on delete set null;
alter table public.caixa_socios add column if not exists aceito_em timestamptz;
alter table public.caixa_socios add column if not exists reaberto_em timestamptz;
alter table public.caixa_socios add column if not exists reaberto_motivo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.caixa_socios'::regclass and conname = 'caixa_socios_reaberto_motivo_tam') then
    alter table public.caixa_socios add constraint caixa_socios_reaberto_motivo_tam
      check (reaberto_motivo is null or char_length(reaberto_motivo) <= 1000);
  end if;
end;
$$;

create index if not exists caixa_socios_aguardando_aceite on public.caixa_socios (autor) where status = 'aguardando_aceite';
create index if not exists idx_caixa_socios_aceito_por on public.caixa_socios (aceito_por);

-- Só o autor aceita ou reabre. Mudança sem usuário logado (service role: o Moacir) passa.
create or replace function public.caixa_socios_aceite_so_autor()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'aguardando_aceite' and new.status is distinct from old.status
     and auth.uid() is not null and auth.uid() is distinct from old.autor then
    raise exception 'Só quem fez o pedido aceita ou reabre.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists caixa_socios_aceite_so_autor on public.caixa_socios;
create trigger caixa_socios_aceite_so_autor before update on public.caixa_socios
  for each row execute function public.caixa_socios_aceite_so_autor();

drop function if exists public.caixa_socios_pendentes();
create function public.caixa_socios_pendentes()
returns table (id uuid, criado_em timestamptz, tipo text, texto text, arquivo_nome text, texto_extraido text, extracao_status text, reaberto_motivo text)
language sql stable security definer set search_path = public as $$
  select c.id, c.criado_em, c.tipo, c.texto, c.arquivo_nome, c.texto_extraido, c.extracao_status, c.reaberto_motivo
    from public.caixa_socios c
   where (c.status = 'novo'
          and (c.extracao_status in ('nao_se_aplica','ok','falhou','desligada') or c.criado_em < now() - interval '10 minutes'))
      or (c.status = 'em_andamento' and c.reaberto_em is not null and c.reaberto_em > coalesce(c.respondido_em, 'epoch'::timestamptz))
   order by c.criado_em
   limit 30;
$$;

create or replace function public.responder_caixa_socios(p_id uuid, p_status text, p_resposta text, p_ordem uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text := p_status;
begin
  if p_status not in ('em_andamento','feito','aguardando_aceite','precisa_daniel') then raise exception 'status inválido'; end if;
  if p_resposta is null or char_length(btrim(p_resposta)) = 0 or char_length(p_resposta) > 4000 then raise exception 'resposta inválida'; end if;
  if v_status = 'feito' then v_status := 'aguardando_aceite'; end if;   -- quem pediu é quem dá por feito
  update public.caixa_socios
     set status = v_status, resposta = p_resposta, respondido_em = now(), ordem_id = coalesce(p_ordem, ordem_id)
   where id = p_id;
end;
$$;

revoke all on function public.caixa_socios_pendentes() from public, anon, authenticated;
revoke all on function public.responder_caixa_socios(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.caixa_socios_pendentes() to service_role;
grant execute on function public.responder_caixa_socios(uuid, text, text, uuid) to service_role;

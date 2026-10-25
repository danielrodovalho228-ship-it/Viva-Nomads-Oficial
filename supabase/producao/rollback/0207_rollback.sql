-- Viva Nomads — rollback da 0207 (Aceite do sócio). Idempotente.
-- Itens em 'aguardando_aceite' voltam a 'feito' (o estado anterior à regra) e itens reabertos a 'em_andamento' já estão assim.
begin;
set local lock_timeout = '5s';
drop trigger if exists caixa_socios_aceite_so_autor on public.caixa_socios;
drop function if exists public.caixa_socios_aceite_so_autor();
update public.caixa_socios set status = 'feito' where status = 'aguardando_aceite';
alter table public.caixa_socios drop constraint if exists caixa_socios_status_check;
alter table public.caixa_socios add constraint caixa_socios_status_check check (status in ('novo','em_andamento','feito','precisa_daniel'));
drop function if exists public.caixa_socios_pendentes();
create function public.caixa_socios_pendentes()
returns table (id uuid, criado_em timestamptz, tipo text, texto text, arquivo_nome text, texto_extraido text, extracao_status text)
language sql stable security definer set search_path = public as $$
  select c.id, c.criado_em, c.tipo, c.texto, c.arquivo_nome, c.texto_extraido, c.extracao_status
    from public.caixa_socios c
   where c.status = 'novo'
     and (c.extracao_status in ('nao_se_aplica','ok','falhou','desligada') or c.criado_em < now() - interval '10 minutes')
   order by c.criado_em
   limit 30;
$$;
create or replace function public.responder_caixa_socios(p_id uuid, p_status text, p_resposta text, p_ordem uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('em_andamento','feito','precisa_daniel') then raise exception 'status inválido'; end if;
  if p_resposta is null or char_length(btrim(p_resposta)) = 0 or char_length(p_resposta) > 4000 then raise exception 'resposta inválida'; end if;
  update public.caixa_socios
     set status = p_status, resposta = p_resposta, respondido_em = now(), ordem_id = coalesce(p_ordem, ordem_id)
   where id = p_id;
end;
$$;
revoke all on function public.caixa_socios_pendentes() from public, anon, authenticated;
revoke all on function public.responder_caixa_socios(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.caixa_socios_pendentes() to service_role;
grant execute on function public.responder_caixa_socios(uuid, text, text, uuid) to service_role;
alter table public.caixa_socios drop column if exists aceito_por, drop column if exists aceito_em,
  drop column if exists reaberto_em, drop column if exists reaberto_motivo;
drop index if exists public.caixa_socios_aguardando_aceite;
delete from supabase_migrations.schema_migrations where version = '20261022000207';
commit;

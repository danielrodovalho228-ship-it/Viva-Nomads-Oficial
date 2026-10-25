-- 0194 — Códigos de recuperação do 2FA: consumo e troca de lote ATÔMICOS no banco (ordem 8add190a).
-- Só service_role executa (search_path fixo). Não guardam nem devolvem código, só hash. Idempotente.

-- Marca UM código como usado. Devolve true só para o pedido que conseguiu (dois pedidos simultâneos: 1 true, 1 false).
create or replace function public.consumir_codigo_recuperacao(p_user_id uuid, p_codigo_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id uuid;
begin
  update public.mfa_codigos_recuperacao
     set usado_em = now()
   where user_id = p_user_id
     and codigo_hash = p_codigo_hash
     and usado_em is null
  returning id into v_id;
  return v_id is not null;
end;
$fn$;

-- Troca o lote inteiro numa transação: ou entram os códigos novos e saem os antigos, ou nada muda.
create or replace function public.trocar_codigos_recuperacao(p_user_id uuid, p_hashes text[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if p_hashes is null or coalesce(array_length(p_hashes, 1), 0) = 0 then
    raise exception 'lote vazio';
  end if;
  delete from public.mfa_codigos_recuperacao where user_id = p_user_id;
  insert into public.mfa_codigos_recuperacao (user_id, codigo_hash)
  select p_user_id, h from unnest(p_hashes) as h;
  return array_length(p_hashes, 1);
end;
$fn$;

revoke all on function public.consumir_codigo_recuperacao(uuid, text) from public, anon, authenticated;
revoke all on function public.trocar_codigos_recuperacao(uuid, text[]) from public, anon, authenticated;
grant execute on function public.consumir_codigo_recuperacao(uuid, text) to service_role;
grant execute on function public.trocar_codigos_recuperacao(uuid, text[]) to service_role;

comment on function public.consumir_codigo_recuperacao(uuid, text) is 'Uso único atômico de um código de recuperação do 2FA. Só service_role.';
comment on function public.trocar_codigos_recuperacao(uuid, text[]) is 'Troca o lote de códigos de recuperação do 2FA numa transação. Só service_role.';

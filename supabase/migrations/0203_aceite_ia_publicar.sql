-- 0203 — Publicar com texto de IA exige o aceite do dono NO BANCO (ordem ea41ad13 / achado #59 do Bruno).
-- Por quê: hoje só a Server Action confere o aceite (anuncio_aceites_ia, 0103); quem chama o REST com o próprio token
-- publicaria um texto de IA sem declarar que revisou. Regra: ao virar 'active' (INSERT ou UPDATE vindo de outro status)
-- com descricao_gerada_por_ia = true, tem de existir ao menos um aceite do imóvel. A VERSÃO do termo continua sendo
-- validada no servidor (validarAceiteIa, TERMO_IA_VERSAO): a tabela só aceita o que o servidor gravou.
-- Ficam de fora o dono do banco, o service_role (semente do laboratório) e gatilhos aninhados, como no portão da 0120.
-- Idempotente. Sem comandos que gerem NOTICE. Rollback: supabase/producao/rollback/0203_rollback.sql.
create or replace function public.properties_exige_aceite_ia() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status::text = 'active'
     and coalesce(new.descricao_gerada_por_ia, false)
     and (tg_op = 'INSERT' or old.status::text is distinct from 'active')
     and current_user not in ('supabase_admin', 'postgres', 'service_role')
     and pg_trigger_depth() <= 1
     and not exists (select 1 from public.anuncio_aceites_ia a where a.property_id = new.id)
  then
    raise exception 'Confirme que revisou o texto feito com IA antes de publicar' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace trigger trg_properties_exige_aceite_ia
  before insert or update of status on public.properties
  for each row execute function public.properties_exige_aceite_ia();

-- Laboratório (nunca em produção): prova da 0196 — sinais da ordem dos imóveis (Prompt 33).
-- Roda tudo dentro de begin/rollback; não deixa nada gravado. Esperado: todas as linhas "ok" = t e os NOTICE "ok: …".
-- Uso: psql "$LAB_DB" -v ON_ERROR_STOP=1 -f supabase/lab/teste-0196-ranking-sinais.sql
begin;
create temp table alvo as select p.id, p.owner_id from properties p limit 1;
grant select on alvo to authenticated, service_role;

-- 1) cômodo fora da lista é recusado
do $$ begin
  insert into property_photos (property_id, url, comodo) select id, 'lab/x.jpg', 'varanda_gourmet' from alvo;
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: cômodo inválido recusado';
end $$;
insert into property_photos (property_id, url, comodo) select id, 'lab/sala.jpg', 'sala' from alvo;
insert into property_photos (property_id, url, comodo) select id, 'lab/quarto.jpg', 'quarto' from alvo;

-- 2) o dono não escolhe a data: "confirmar no futuro" vira now()
select set_config('request.jwt.claim.sub', (select owner_id::text from alvo), true);
set local role authenticated;
update properties set disponibilidade_confirmada_em = '2030-01-01' where id = (select id from alvo);
reset role;
select 'futuro vira agora' as caso, disponibilidade_confirmada_em < now() + interval '1 minute' as ok
  from properties where id = (select id from alvo);

-- 3) bloco criado pelo dono confirma o calendário
update properties set disponibilidade_confirmada_em = null where id = (select id from alvo);
set local role authenticated;
insert into property_blocks (property_id, inicio, fim) select id, current_date + 400, current_date + 405 from alvo;
reset role;
select 'bloco do dono confirma' as caso, disponibilidade_confirmada_em is not null as ok
  from properties where id = (select id from alvo);

-- 4) ranking_sinais: só service_role; conta 2+ cômodos distintos
set local role authenticated;
do $$ begin
  perform ranking_sinais(array[(select id from alvo)]);
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: authenticated sem execute';
end $$;
reset role;
set local role service_role;
select 'ranking_sinais lê o imóvel' as caso, comodos_distintos >= 2 and disponibilidade_confirmada_em is not null as ok
  from ranking_sinais(array[(select id from alvo)]);
reset role;

-- 5) anon não lê sombra nem interruptor
set local role anon;
do $$ begin
  perform 1 from ranking_sombra;
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: anon sem ranking_sombra';
end $$;
do $$ begin
  perform 1 from plataforma_chaves;
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: anon sem plataforma_chaves';
end $$;
reset role;
rollback;

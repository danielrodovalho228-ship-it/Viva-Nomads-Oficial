-- Laboratório (nunca em produção): prova da 0206 — minimização e eliminação, fase 1 (Prompt 58).
-- Roda tudo dentro de begin/rollback; não deixa nada gravado. Esperado: todas as linhas "ok" = t e os NOTICE "ok: …".
-- Uso: psql "$LAB_DB" -v ON_ERROR_STOP=1 -f supabase/lab/teste-0206-minimizacao.sql
begin;
insert into auth.users (id, email) values
  ('58000000-0000-4000-8000-0000000000a1', 'lab-58-admin@teste.vivanomads.com.br'),
  ('58000000-0000-4000-8000-0000000000d1', 'lab-58-dono@teste.vivanomads.com.br');
insert into profiles (id) values ('58000000-0000-4000-8000-0000000000a1'), ('58000000-0000-4000-8000-0000000000d1') on conflict (id) do nothing;
update profiles set role = 'admin' where id = '58000000-0000-4000-8000-0000000000a1';
insert into properties (id, owner_id, title, city, monthly_price, status)
values ('58000000-0000-4000-8000-0000000000b1', '58000000-0000-4000-8000-0000000000d1', 'Studio Lab 58', 'Uberlândia', 2500, 'active');

insert into eliminacoes_registro (origem, ref_id, tipo, motivo, modo) values ('bucket:inquilino-docs', 'a/b/c.png', 'inquilino-docs/recusado', 'prazo', 'apagado');
insert into eliminacoes_simulado (dia, item, vencidos, prazo, base) values (current_date, 'messages', 3, 'pendente – item 13 da Dra. Beatriz', 'pendente – item 13');
insert into eliminacoes_alertas (item, erro) values ('matricula/arquivo', 'property-docs: falhou');
insert into fotos_anuncio_hash (property_id, owner_id, caminho, hash)
values ('58000000-0000-4000-8000-0000000000b1', '58000000-0000-4000-8000-0000000000d1', '58000000-0000-4000-8000-0000000000d1/f.webp', '0123456789abcdef');

-- 1) Regras das tabelas.
do $$ begin
  insert into eliminacoes_registro (origem, ref_id, tipo, motivo, modo) values ('bucket:x', 'y', 'z', 'porque_sim', 'apagado');
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: motivo fora da lista é recusado';
end $$;
do $$ begin
  insert into fotos_anuncio_hash (owner_id, caminho, hash) values ('58000000-0000-4000-8000-0000000000d1', 'x.webp', 'NAO-E-HEX');
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: hash só 16 hexadecimais';
end $$;
select 'livro não tem coluna de conteúdo' as caso,
       (select array_agg(column_name::text order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'eliminacoes_registro')
       = array['eliminado_em', 'id', 'modo', 'motivo', 'origem', 'ref_id', 'teste', 'tipo'] as ok;

-- 2) Só o veredito: os caminhos aceitam nulo.
select 'caminho do documento da candidatura aceita nulo' as caso,
       (select is_nullable = 'YES' from information_schema.columns where table_schema = 'public' and table_name = 'documentos_inquilino' and column_name = 'caminho') as ok;
select 'caminho da matrícula aceita nulo' as caso,
       (select is_nullable = 'YES' from information_schema.columns where table_schema = 'public' and table_name = 'property_ownership_checks' and column_name = 'arquivo_path') as ok;

-- 3) O hash sobrevive à remoção do anúncio.
delete from properties where id = '58000000-0000-4000-8000-0000000000b1';
select 'hash fica depois de remover o anúncio' as caso, (select count(*) = 1 from fotos_anuncio_hash where hash = '0123456789abcdef') as ok;

-- 4) RLS: só o admin lê; ninguém escreve pelo navegador.
select set_config('request.jwt.claim.sub', '58000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
select 'admin lê o livro, o relatório, os alertas e os hashes' as caso,
       (select count(*) from eliminacoes_registro) = 1 and (select count(*) from eliminacoes_simulado) = 1
       and (select count(*) from eliminacoes_alertas) = 1 and (select count(*) from fotos_anuncio_hash) = 1 as ok;
do $$ begin
  insert into eliminacoes_registro (origem, ref_id, tipo, motivo, modo) values ('bucket:x', 'y', 'z', 'prazo', 'apagado');
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: nem o admin grava no livro pelo navegador';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '58000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
select 'quem não é admin não lê nada' as caso,
       (select count(*) from eliminacoes_registro) + (select count(*) from eliminacoes_simulado)
       + (select count(*) from eliminacoes_alertas) + (select count(*) from fotos_anuncio_hash) = 0 as ok;
reset role;
set local role anon;
select 'anônimo não lê nada' as caso, (select count(*) from eliminacoes_registro) + (select count(*) from fotos_anuncio_hash) = 0 as ok;
reset role;
rollback;

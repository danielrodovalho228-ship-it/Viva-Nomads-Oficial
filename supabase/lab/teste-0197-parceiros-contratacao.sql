-- Laboratório (nunca em produção): prova da 0197 — contratação de parceiros (Prompt 31b).
-- Roda tudo dentro de begin/rollback; não deixa nada gravado. Esperado: todas as linhas "ok" = t e os NOTICE "ok: …".
-- Uso: psql "$LAB_DB" -v ON_ERROR_STOP=1 -f supabase/lab/teste-0197-parceiros-contratacao.sql
begin;
insert into auth.users (id, email) values
  ('31b00000-0000-4000-8000-0000000000c1', 'lab-31b-cliente@teste.vivanomads.com.br'),
  ('31b00000-0000-4000-8000-0000000000f1', 'lab-31b-parceiro@teste.vivanomads.com.br');
insert into profiles (id) values ('31b00000-0000-4000-8000-0000000000c1'), ('31b00000-0000-4000-8000-0000000000f1')
  on conflict (id) do nothing;
insert into parceiros (id, user_id, tipo_pessoa, documento, nome_publico, slug, categorias, status)
values ('31b00000-0000-4000-8000-0000000000a1', '31b00000-0000-4000-8000-0000000000f1', 'pf', '11144477735', 'Fotos Lab', 'fotos-lab-31b',
        array['fotografia'], 'publicado');
insert into parceiro_pedidos (id, codigo, parceiro_id, cliente_id, categoria, descricao, horarios_propostos)
values ('31b00000-0000-4000-8000-0000000000e1', 'VN-SV-LAB31B01', '31b00000-0000-4000-8000-0000000000a1',
        '31b00000-0000-4000-8000-0000000000c1', 'fotografia', 'Fotos do apartamento',
        array[now() + interval '2 days', now() + interval '3 days']);

-- 1) status novo "em_execucao" vale; status inventado não
update parceiro_pedidos set status = 'em_execucao' where id = '31b00000-0000-4000-8000-0000000000e1';
do $$ begin
  update parceiro_pedidos set status = 'pago' where id = '31b00000-0000-4000-8000-0000000000e1';
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: status inventado recusado';
end $$;

-- 2) divisão sempre fecha: 350 = 35 + 315; 350 ≠ 35 + 300 é recusado
update parceiro_pedidos set valor_combinado = 350, taxa_percent = 0.100, valor_taxa = 35, valor_parceiro = 315
 where id = '31b00000-0000-4000-8000-0000000000e1';
do $$ begin
  update parceiro_pedidos set valor_parceiro = 300 where id = '31b00000-0000-4000-8000-0000000000e1';
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: divisão que não fecha recusada';
end $$;

-- 3) no máximo 3 horários; pagamento só indisponivel/simulado/pago
do $$ begin
  update parceiro_pedidos set horarios_propostos = array[now(), now(), now(), now()] where id = '31b00000-0000-4000-8000-0000000000e1';
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: 4 horários recusados';
end $$;
select 'pagamento nasce indisponível' as caso, pagamento_status = 'indisponivel' and origem = 'manual' as ok
  from parceiro_pedidos where id = '31b00000-0000-4000-8000-0000000000e1';

-- 4) só o servidor grava: authenticated (cliente) não altera o pedido nem cria avaliação
select set_config('request.jwt.claim.sub', '31b00000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
do $$ begin
  update parceiro_pedidos set status = 'concluido' where id = '31b00000-0000-4000-8000-0000000000e1';
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: cliente não grava status';
end $$;
do $$ begin
  insert into parceiro_avaliacoes (pedido_id, autor_id, papel_autor, nota) values ('31b00000-0000-4000-8000-0000000000e1', '31b00000-0000-4000-8000-0000000000c1', 'cliente', 5);
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: cliente não grava avaliação direto';
end $$;
reset role;

-- 5) avaliação cega: com uma só, nada publica; com as duas, publica e a nota vai para a página do parceiro
update parceiro_pedidos set status = 'concluido', concluido_em = now() where id = '31b00000-0000-4000-8000-0000000000e1';
insert into parceiro_avaliacoes (pedido_id, autor_id, papel_autor, nota, texto)
values ('31b00000-0000-4000-8000-0000000000e1', '31b00000-0000-4000-8000-0000000000c1', 'cliente', 4, 'Fotos ótimas');
select 'uma só não publica' as caso, publicar_avaliacoes_parceiro('31b00000-0000-4000-8000-0000000000e1') = 0 as ok;
-- o parceiro não vê a avaliação do cliente antes de publicar
select set_config('request.jwt.claim.sub', '31b00000-0000-4000-8000-0000000000f1', true);
set local role authenticated;
select 'cega antes de publicar' as caso, count(*) = 0 as ok from parceiro_avaliacoes where autor_id = '31b00000-0000-4000-8000-0000000000c1';
reset role;
insert into parceiro_avaliacoes (pedido_id, autor_id, papel_autor, nota)
values ('31b00000-0000-4000-8000-0000000000e1', '31b00000-0000-4000-8000-0000000000f1', 'parceiro', 5);
select 'as duas publicam' as caso, publicar_avaliacoes_parceiro('31b00000-0000-4000-8000-0000000000e1') = 2 as ok;
select 'nota na página do parceiro' as caso, nota_media = 4.0 and avaliacoes_qtd = 1 as ok
  from parceiros where id = '31b00000-0000-4000-8000-0000000000a1';

-- 6) bucket das entregas é privado
select 'bucket privado' as caso, public = false as ok from storage.buckets where id = 'parceiro-entregas';
rollback;

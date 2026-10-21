-- Laboratório (nunca em produção): prova da 0201 — registro único de documentos, numeração e /conferir (Prompt 56).
-- Roda tudo dentro de begin/rollback; não deixa nada gravado. Esperado: todas as linhas "ok" = t e os NOTICE "ok: …".
-- Uso: psql "$LAB_DB" -v ON_ERROR_STOP=1 -f supabase/lab/teste-0201-documentos-registro.sql
begin;
insert into auth.users (id, email) values
  ('56000000-0000-4000-8000-0000000000d1', 'lab-56-dono@teste.vivanomads.com.br'),
  ('56000000-0000-4000-8000-0000000000a1', 'lab-56-morador@teste.vivanomads.com.br'),
  ('56000000-0000-4000-8000-0000000000e1', 'lab-56-terceiro@teste.vivanomads.com.br');
insert into profiles (id) values
  ('56000000-0000-4000-8000-0000000000d1'), ('56000000-0000-4000-8000-0000000000a1'), ('56000000-0000-4000-8000-0000000000e1')
  on conflict (id) do nothing;
update profiles set is_teste = true where id = '56000000-0000-4000-8000-0000000000a1';
insert into properties (id, owner_id, title, city, monthly_price)
values ('56000000-0000-4000-8000-0000000000b1', '56000000-0000-4000-8000-0000000000d1', 'Apto Lab 56', 'Uberlândia', 3200);

-- 1) Legado: contrato e documento fiscal criados SEM o registro (como antes da 0201) ganham a linha no backfill,
--    pela ordem de criação, sem mudar número, hash nem código.
alter table contratos disable trigger contratos_registro;
insert into contratos (id, property_id, tenant_id, faixa, prazo_total_dias, aluguel_mensal, qtd_ocupantes, created_at)
values ('56000000-0000-4000-8000-0000000000c1', '56000000-0000-4000-8000-0000000000b1', '56000000-0000-4000-8000-0000000000a1',
        'media_estadia', 90, 3200, 1, '2020-01-01 10:00+00');
alter table contratos enable trigger contratos_registro;
alter table documentos_fiscais disable trigger documentos_fiscais_registro;
insert into documentos_fiscais (id, tipo, numero, ano, tenant_id, locatario_nome, valor, hash, codigo_verificacao, pdf_path, criado_em)
values ('56000000-0000-4000-8000-0000000000f1', 'informe_anual', 'INF-2020-000007', 2020, '56000000-0000-4000-8000-0000000000a1',
        'Morador Lab', 0, repeat('a', 64), repeat('b', 32), '2020/informe_anual/INF-2020-000007.pdf', '2020-01-02 10:00+00');
alter table documentos_fiscais enable trigger documentos_fiscais_registro;
\i supabase/migrations/0201_documentos_registro.sql
select 'backfill: contrato legado registrado com o VN-CT de sempre' as caso,
       count(*) = 1 and min(numero) = 'VN-CT-56000000' and min(prefixo) = 'VN-CT' as ok
  from documentos_registro where ref_tabela = 'contratos' and ref_id = '56000000-0000-4000-8000-0000000000c1';
select 'backfill: documento fiscal com o mesmo número, hash e código' as caso,
       count(*) = 1 and min(numero) = 'INF-2020-000007' and min(prefixo) = 'INF' and min(hash_sha256) = repeat('a', 64)
       and min(codigo_verificacao) = repeat('b', 32) as ok
  from documentos_registro where ref_tabela = 'documentos_fiscais' and ref_id = '56000000-0000-4000-8000-0000000000f1';
select 'backfill: Registro nº segue a ordem de criação' as caso,
       (select registro_seq from documentos_registro where ref_id = '56000000-0000-4000-8000-0000000000c1')
     < (select registro_seq from documentos_registro where ref_id = '56000000-0000-4000-8000-0000000000f1') as ok;
select 'backfill: parte de teste marca o documento como teste' as caso,
       bool_and(is_teste) as ok from documentos_registro where ref_id in ('56000000-0000-4000-8000-0000000000c1', '56000000-0000-4000-8000-0000000000f1');
\i supabase/migrations/0201_documentos_registro.sql
select 'backfill idempotente: reaplicar não duplica' as caso, count(*) = 2 as ok
  from documentos_registro where ref_id in ('56000000-0000-4000-8000-0000000000c1', '56000000-0000-4000-8000-0000000000f1');

-- 1b) Documento fiscal gravado direto (seed do laboratório) entra no registro com o próprio código.
insert into documentos_fiscais (id, tipo, numero, ano, tenant_id, locatario_nome, valor, hash, codigo_verificacao, pdf_path)
values ('56000000-0000-4000-8000-0000000000f2', 'informe_anual', 'INF-LAB-1', 2031, '56000000-0000-4000-8000-0000000000e1',
        'Terceiro Lab', 0, repeat('7', 64), repeat('8', 32), 'lab/inf.pdf');
select 'documento fiscal direto registrado com o próprio código' as caso,
       count(*) = 1 and min(codigo_verificacao) = repeat('8', 32) and min(prefixo) = 'INF' as ok
  from documentos_registro where ref_id = '56000000-0000-4000-8000-0000000000f2';

-- 2) Contrato novo entra no registro pelo gatilho — mesmo quando o VN-CT coincide com o de outro contrato.
insert into contratos (id, property_id, tenant_id, faixa, prazo_total_dias, aluguel_mensal, qtd_ocupantes)
values ('56000000-0000-4000-8000-0000000000c2', '56000000-0000-4000-8000-0000000000b1', '56000000-0000-4000-8000-0000000000e1',
        'media_estadia', 90, 3200, 1);
select 'contrato novo registrado na criação (VN-CT igual ao do legado não impede)' as caso, count(*) = 1 as ok
  from documentos_registro where ref_tabela = 'contratos' and ref_id = '56000000-0000-4000-8000-0000000000c2';

-- 3) Numeração: prefixos novos com 6 dígitos e o ano de Brasília; sequência sem reuso; RPS nunca.
select 'PRV numerado com 6 dígitos' as caso, proximo_numero_documento('PRV') ~ ('^PRV-' || extract(year from now() at time zone 'America/Sao_Paulo') || '-[0-9]{6}$') as ok;
select 'contador do PRV avança' as caso, proximo_numero_documento('PRV') <> proximo_numero_documento('PRV') as ok;
do $$ begin
  perform proximo_numero_documento('RPS');
  raise exception 'DEVIA_RECUSAR';
exception when invalid_parameter_value then raise notice 'ok: RPS não é prefixo da Viva';
end $$;
do $$ begin
  perform registrar_documento('PRV', 'pacote_provas', 'RPS-2026-000001', 'contratos', '56000000-0000-4000-8000-0000000000c1',
                              repeat('c', 64), null, array['56000000-0000-4000-8000-0000000000d1']::uuid[], false);
  raise exception 'DEVIA_RECUSAR';
exception when invalid_parameter_value then raise notice 'ok: número começando por RPS recusado';
end $$;

-- 4) Versões: mesmo número, versão + 1, a anterior vira "substituido"; a sequência do registro nunca se repete.
create temp table v1 as
  select * from registrar_documento('ORC', 'proposta', 'ORC-2026-9001', 'propostas', '56000000-0000-4000-8000-0000000000f9',
                                    repeat('1', 64), null, array['56000000-0000-4000-8000-0000000000d1', '56000000-0000-4000-8000-0000000000a1']::uuid[], false);
create temp table v2 as
  select * from registrar_documento('ORC', 'proposta', 'ORC-2026-9001', 'propostas', '56000000-0000-4000-8000-0000000000f9',
                                    repeat('2', 64), null, array['56000000-0000-4000-8000-0000000000d1', '56000000-0000-4000-8000-0000000000a1']::uuid[], false,
                                    null, true);
select 'versão nova: mesmo número, v2' as caso, (select versao from v2) = 2 and (select numero from v2) = 'ORC-2026-9001' as ok;
select 'versão anterior virou substituído' as caso,
       (select status from documentos_registro where id = (select id from v1)) = 'substituido'
   and (select status from documentos_registro where id = (select id from v2)) = 'valido' as ok;
create temp table v4 as
  select * from registrar_documento('ORC', 'proposta', 'ORC-2026-9001', 'propostas', '56000000-0000-4000-8000-0000000000f9',
                                    repeat('4', 64), null, '{}'::uuid[], false, null, true, 4);
select 'versão pode pular (proposta com rodadas antes do registro), nunca repetir' as caso, (select versao from v4) = 4 as ok;
do $$ begin
  perform registrar_documento('ORC', 'proposta', 'ORC-2026-9001', 'propostas', '56000000-0000-4000-8000-0000000000f9',
                              repeat('5', 64), null, '{}'::uuid[], false, null, true, 3);
  raise exception 'DEVIA_RECUSAR';
exception when serialization_failure then raise notice 'ok: versão antiga recusada';
end $$;
select 'registro_seq sem reuso' as caso, (select registro_seq from v2) > (select registro_seq from v1) as ok;
do $$ begin
  perform registrar_documento('ORC', 'proposta', 'ORC-2026-9999', 'propostas', '56000000-0000-4000-8000-0000000000f9',
                              repeat('3', 64), null, '{}'::uuid[], false, null, true);
  raise exception 'DEVIA_RECUSAR';
exception when invalid_parameter_value then raise notice 'ok: versão nova não troca o número';
end $$;

-- 5) Anulação: segue do documento fiscal para o registro; a sequência não ganha buraco; status só muda uma vez.
create temp table seq_antes as select max(registro_seq) as m from documentos_registro;
update documentos_fiscais set anulado_em = now(), anulado_motivo = 'Duplicidade de lançamento'
 where id = '56000000-0000-4000-8000-0000000000f1';
select 'anulação chega ao registro com o motivo' as caso,
       status = 'anulado' and anulado_motivo = 'Duplicidade de lançamento' and status_em is not null as ok
  from documentos_registro where ref_id = '56000000-0000-4000-8000-0000000000f1';
select 'anular não consome número da sequência' as caso, (select max(registro_seq) from documentos_registro) = (select m from seq_antes) as ok;
do $$ begin
  update documentos_registro set status = 'valido' where ref_id = '56000000-0000-4000-8000-0000000000f1';
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: anulado não volta a valer';
end $$;
do $$ begin
  update documentos_registro set hash_sha256 = repeat('f', 64) where id = (select id from v2);
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: hash registrado não muda';
end $$;
do $$ begin
  delete from documentos_registro where id = (select id from v2);
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: documento registrado não se apaga';
end $$;

-- 6) /conferir: só pelo código; sem valor nem iniciais; status, versão vigente e teste.
select 'conferir pelo código devolve status, número e versão' as caso,
       c.numero = 'ORC-2026-9001' and c.versao = 1 and c.status = 'substituido' and c.versao_vigente = 4 as ok
  from conferir_documento((select codigo_verificacao from v1)) c;
select 'conferir de documento de teste avisa' as caso, c.is_teste as ok from conferir_documento(repeat('b', 32)) c;
select 'número sozinho não responde' as caso, count(*) = 0 as ok from conferir_documento('ORC-2026-9001');
select 'conferir sem valor nem iniciais' as caso,
       not exists (select 1 from pg_proc p, unnest(p.proargnames) a where p.proname = 'conferir_documento' and a in ('valor', 'locador', 'locatario')) as ok;
select set_config('lab.codigo_ct', (select codigo_verificacao from documentos_registro where ref_id = '56000000-0000-4000-8000-0000000000c1'), true);
set local role anon;
select 'anon confere pelo código' as caso, count(*) = 1 as ok from conferir_documento(current_setting('lab.codigo_ct'));
reset role;

-- 7) RLS: partes leem, terceiro e anon não; ninguém grava direto.
select set_config('request.jwt.claim.sub', '56000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
select 'parte lê o registro dos seus documentos' as caso, count(*) >= 3 as ok from documentos_registro;
do $$ begin
  insert into documentos_registro (prefixo, numero, tipo, ref_tabela, ref_id) values ('PRV', 'PRV-2026-000001', 'x', 'contratos', gen_random_uuid());
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: ninguém grava no registro direto';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '56000000-0000-4000-8000-0000000000e1', true);
set local role authenticated;
select 'terceiro não lê documento alheio' as caso,
       count(*) filter (where ref_id in ('56000000-0000-4000-8000-0000000000c1', '56000000-0000-4000-8000-0000000000f9')) = 0 as ok
  from documentos_registro;
reset role;
set local role anon;
do $$ begin
  perform 1 from documentos_registro;
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: anon sem acesso ao registro';
end $$;
reset role;

-- 8) Conferência: o fechamento grava o hash uma vez; depois nada muda; a cascata do contrato apagado passa.
insert into conferencias (id, contrato_id, tipo) values ('56000000-0000-4000-8000-0000000000c9', '56000000-0000-4000-8000-0000000000c2', 'entrada');
insert into conferencia_itens (conferencia_id, parte, comodo, descricao) values ('56000000-0000-4000-8000-0000000000c9', 'proprietario', 'Sala', 'Sofá novo');
select 'fecha a conferência' as caso, fechar_conferencia('56000000-0000-4000-8000-0000000000c9', repeat('d', 64), 'janela_encerrada', array['inquilino']) as ok;
select 'segundo fechamento não muda nada' as caso,
       not fechar_conferencia('56000000-0000-4000-8000-0000000000c9', repeat('e', 64), 'duas_respostas')
   and (select fechamento_hash from conferencias where id = '56000000-0000-4000-8000-0000000000c9') = repeat('d', 64) as ok;
do $$ begin
  insert into conferencia_itens (conferencia_id, parte, comodo, descricao) values ('56000000-0000-4000-8000-0000000000c9', 'inquilino', 'Sala', 'Risco');
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: item novo recusado depois do fechamento';
end $$;
do $$ begin
  insert into conferencia_respostas (conferencia_id, parte, decisao) values ('56000000-0000-4000-8000-0000000000c9', 'inquilino', 'confirmou');
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: resposta depois do fechamento recusada';
end $$;
do $$ begin
  update conferencias set fechamento_hash = repeat('f', 64) where id = '56000000-0000-4000-8000-0000000000c9';
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: hash de fechamento imutável';
end $$;
insert into conferencia_correcoes (conferencia_id, versao, motivo, texto, hash)
values ('56000000-0000-4000-8000-0000000000c9', 2, 'Item esquecido na sala', 'Tomada solta atrás do sofá', repeat('9', 64));
do $$ begin
  update conferencia_correcoes set motivo = 'outro motivo' where conferencia_id = '56000000-0000-4000-8000-0000000000c9';
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: correção imutável';
end $$;
delete from contratos where id = '56000000-0000-4000-8000-0000000000c2';
select 'contrato apagado leva a conferência fechada junto (cascata)' as caso,
       not exists (select 1 from conferencias where id = '56000000-0000-4000-8000-0000000000c9') as ok;
select 'o registro do contrato apagado continua' as caso, count(*) = 1 as ok
  from documentos_registro where ref_id = '56000000-0000-4000-8000-0000000000c2';
rollback;

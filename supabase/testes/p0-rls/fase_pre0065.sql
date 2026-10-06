-- (datas no fuso de Brasília, como o ciclo diário — current_date é UTC e quebrava entre 21h e 0h)
-- Antes da 0065 (0063 e 0064 aplicadas como estão): os problemas da revisão.
reset role;
-- Contrato ANTIGO (anterior à 0063): bloco 2 'agendado' sem aceites e um
-- contrato de 12 meses — gravados antes de o trigger existir.
alter table public.contrato_blocos disable trigger trg_contrato_blocos_regras;
insert into public.contratos (id, property_id, tenant_id, status, aluguel_mensal) values
 ('dddddd65-0000-0000-0000-000000000001','aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','ativo',3000),
 ('dddddd65-0000-0000-0000-000000000002','aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','ativo',3000);
insert into public.contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, status) values
 ('b6500000-0000-0000-0000-000000000001','dddddd65-0000-0000-0000-000000000001',1, (now() at time zone 'America/Sao_Paulo')::date - 70, (now() at time zone 'America/Sao_Paulo')::date - 1, 2, 6000, 3000, 'ativo'),
 ('b6500000-0000-0000-0000-000000000002','dddddd65-0000-0000-0000-000000000001',2, (now() at time zone 'America/Sao_Paulo')::date, (now() at time zone 'America/Sao_Paulo')::date + 59, 2, 6000, 3000, 'agendado');
insert into public.contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, status)
select ('b6500000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid, 'dddddd65-0000-0000-0000-000000000002', g,
       (now() at time zone 'America/Sao_Paulo')::date + (g - 1) * 60, (now() at time zone 'America/Sao_Paulo')::date + g * 60 - 1, 2, 6000, 3000, case when g = 1 then 'ativo' else 'agendado' end
  from generate_series(1, 6) g;
alter table public.contrato_blocos enable trigger trg_contrato_blocos_regras;

select t('ANTES@0065','ciclo diário aborta com bloco antigo agendado sem aceite','falha',$q$select public.avancar_ciclo_blocos()$q$);
select t('ANTES@0065','comprovar caução de contrato antigo de 12 meses dá erro','falha',$q$update contrato_blocos set caucao_status='comprovada' where id='b6500000-0000-0000-0001-000000000001'$q$);

-- Aceites simultâneos: os dois gravados, o bloco segue pendente (e caducaria).
insert into public.contratos (id, property_id, tenant_id, status, aluguel_mensal) values
 ('dddddd65-0000-0000-0000-000000000003','aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','ativo',3000);
insert into public.contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, status) values
 ('b6500000-0000-0000-0000-000000000031','dddddd65-0000-0000-0000-000000000003',1, (now() at time zone 'America/Sao_Paulo')::date - 10, (now() at time zone 'America/Sao_Paulo')::date + 49, 2, 6000, 3000, 'ativo'),
 ('b6500000-0000-0000-0000-000000000032','dddddd65-0000-0000-0000-000000000003',2, (now() at time zone 'America/Sao_Paulo')::date + 50, (now() at time zone 'America/Sao_Paulo')::date + 109, 2, 6000, 3000, 'pendente_aceite');
update public.contrato_blocos set aceite_proprietario_em = now(), aceite_inquilino_em = now()
 where id = 'b6500000-0000-0000-0000-000000000032';
select v('ANTES@0065','com os dois aceites o bloco fica pendente','select status from contrato_blocos where id=''b6500000-0000-0000-0000-000000000032''','pendente_aceite');
update public.contrato_blocos set aceite_proprietario_em = null, aceite_inquilino_em = null
 where id = 'b6500000-0000-0000-0000-000000000032';

-- Compatibilidade: imóvel livre só até 1 semana depois da entrada.
update public.properties set status = 'active', available_until = (now() at time zone 'America/Sao_Paulo')::date + 35
 where id = 'a6400000-0000-0000-0000-000000000010';
set role service_role;
select v('ANTES@0065','livre só até a 1ª semana aparece compatível para 4 meses','select situacao from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'', ''a6400000-0000-0000-0000-000000000010'')','compativel');
reset role;
-- Fundador sem data.
update public.profiles set fundador = true, fundador_em = null where id = 'f0000000-0000-0000-0000-000000000001';

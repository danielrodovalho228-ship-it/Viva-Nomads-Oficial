reset role;
select v('RB0056','triggers de A3 removidos','select count(*)::text from pg_trigger where tgname in (''trg_qualificacao_protege_revisao'',''trg_properties_protege_campos'')','0');
select v('RB0056','consumir_limite removida','select count(*)::text from pg_proc where proname=''consumir_limite''','0');
select v('RB0056','tabelas de limite/idempotência removidas','select count(*)::text from information_schema.tables where table_name in (''limites_uso'',''cobrancas_fechamento'')','0');
reset role;

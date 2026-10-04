-- Rollback da 0060: volta a regra antiga (última qualificação do DONO).
reset role;
select v('RB0060','trigger do anúncio volta a ler a última do dono','select (prosrc like ''%qc.property_id = new.id%'')::text from pg_proc where proname=''properties_protege_campos''','false');
select v('RB0060','trigger do checklist volta à versão da 0056','select (prosrc like ''%to_jsonb(new)%'')::text from pg_proc where proname=''qualificacao_protege_revisao''','false');

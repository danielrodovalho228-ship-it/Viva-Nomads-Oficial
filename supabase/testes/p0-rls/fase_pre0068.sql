-- Antes da 0068: qualquer conta logada marca Fundador (o bug).
reset role;
update public.profiles set fundador = false, fundador_em = null;
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ANTES@0068','proprietário comum se marca Fundador (BUG da 0063)','passa',$q$select public.marcar_fundador('11111111-1111-1111-1111-111111111111')$q$);
reset role;
update public.profiles set fundador = false, fundador_em = null;

reset role;
select v('RB0054','gerar_referral_code removida','select count(*)::text from pg_proc where proname=''gerar_referral_code''','0');
select v('RB0054','códigos de indicação já gravados ficam','select referral_code from profiles where id=''11111111-1111-1111-1111-111111111111''','VIVA-DONO111');
select v('RB0054','handle_new_user volta à 0052 (sem referred_by)','select (pg_get_functiondef(''public.handle_new_user''::regproc) like ''%referred_by%'')::text','false');
select v('RB0054','handle_new_user da 0052 segue barrando admin','select (pg_get_functiondef(''public.handle_new_user''::regproc) like ''%''''tenant'''', ''''admin''''%'')::text','false');
select v('RB0054','trigger volta à 0052 (sem referred_by)','select (pg_get_functiondef(''public.profiles_bloqueia_confianca''::regproc) like ''%referred_by%'')::text','false');
select v('RB0054','trigger de confiança segue presente','select count(*)::text from pg_trigger where tgname=''trg_profiles_bloqueia_confianca''','1');
select v('RB0054','(d) volta a valer só por conversation_id','select (with_check ilike ''%m.property_id IS DISTINCT FROM%'')::text from pg_policies where policyname=''enviar mensagem''','false');

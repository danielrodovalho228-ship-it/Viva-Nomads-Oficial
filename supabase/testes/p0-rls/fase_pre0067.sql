-- Antes da 0067: não há tabela de eventos.
reset role;
select v('ANTES@0067','tabela eventos não existe','select (to_regclass(''public.eventos'') is null)::text','true');

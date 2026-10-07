-- 0085 — "Executar agora" na Central de Agentes: guarda o disparo da rotina na ordem.
-- Só colunas novas (nullable); RLS e grants da 0078 seguem valendo (só admin).
-- Sem NOTICE; reaplicar é seguro. O código funciona antes dela (a ordem fica "Aguardando ronda").
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'agentes_ordens' and column_name = 'disparada_em') then
    alter table public.agentes_ordens
      add column disparada_em timestamptz,
      add column sessao_url text check (sessao_url is null or sessao_url like 'https://claude.ai/%'),
      add column disparo_erro text check (disparo_erro is null or char_length(disparo_erro) <= 300);
  end if;
end;
$$;

-- Viva Nomads — 0177: a taxa de serviço some da API do morador (contratos e leads), como nas propostas (#866).
-- O morador lê o próprio contrato e a própria candidatura pelo RLS, e a chave pública vai no navegador: com
-- /rest/v1/contratos?select=comissao_valor ele via a taxa. Mesmo padrão do #866 nas propostas: tira o SELECT da
-- tabela e devolve só as colunas que hoje já eram legíveis, MENOS as de taxa (nenhuma coluna fechada é aberta).
-- O dono passa a ler a taxa no servidor (cliente de serviço, depois de conferir que é o dono).
do $$
declare
  t text;
  r text;
  sens text[];
  existentes text;
  cols text;
begin
  foreach t in array array['contratos', 'leads'] loop
    sens := case t
      when 'contratos' then array['comissao_valor', 'comissao_percent', 'valor_comissao', 'taxa_aplicada', 'faixa_no_fechamento', 'modelo_cobranca']
      else array['accepted_commission_rate', 'accepted_plan', 'accepted_commission_origem', 'accepted_commission_faixa']
    end;
    select string_agg(quote_ident(x), ', ') into existentes
      from unnest(sens) x
     where exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t and c.column_name = x);
    foreach r in array array['authenticated', 'anon'] loop
      select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into cols
        from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = t
         and has_column_privilege(r, format('public.%I', t), c.column_name, 'SELECT')
         and c.column_name <> all (sens);
      execute format('revoke select on public.%I from %I', t, r);
      if existentes is not null then
        execute format('revoke select (%s) on public.%I from %I', existentes, t, r);
      end if;
      if cols is not null then
        execute format('grant select (%s) on public.%I to %I', cols, t, r);
      end if;
    end loop;
  end loop;
end;
$$;

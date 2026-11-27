-- Viva Nomads — aplicar 0304 (E625: exemplos de teste em Conforto e Premium pelo motor). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0304_rollback.sql.
begin;
set local lock_timeout = '5s';

-- E625 (rodada antecipa 5, 05/11): a busca só tinha Essencial (8 de 9) — os filtros Conforto e Premium ficavam em 0.
-- Massa × motor: o motor está certo. Conforto e Premium exigem item provado por FOTO FEITA NA HORA, internet MEDIDA (57) e as
-- 4 respostas de ruído; os anúncios de teste só tinham o padrão mínimo (Essencial). Esta migração semeia, PELAS TABELAS REAIS
-- do nível, dois anúncios de teste da conta de QA: a0263000-…0001 (Proativo E264 A, Conforto) e a0269000-…0001 (Proativo E274 C, Premium) — escolhidos por não terem fluxo de nível em prova e por serem de e-mail proativo, que o nível não afeta; o [TESTE QA NÍVEL] Premium da QA (330ebf37) e o Conforto Retomada (126b23ed) não são tocados.
-- ATENÇÃO: é MASSA DE QA. As provas por foto reaproveitam imagens da pasta da conta de teste (não são fotos reais de cada
-- item) e levam o marcador 'e625e625' no foto_hash; as medições são de teste. Só roda para anúncio ATIVO que já está em
-- Essencial, nunca sobrescreve declaração, foto ou ruído existentes (on conflict do nothing) e é idempotente.
-- O imovel_nivel recebe o que o motor (nivelDoImovel) devolve para estas entradas — conferido por teste.
do $$
declare
  v_dono constant uuid := '7216d0e9-6246-482a-a1de-524fd5231dc2';
  v_arquivos text[];
  v_alvo record;
  v_chaves text[];
  v_i int;
  v_n int;
  v_por_area jsonb;
  v_dif jsonb;
begin
  select coalesce(array_agg(o.name order by o.name), '{}') into v_arquivos
    from storage.objects o
   where o.bucket_id = 'property-photos' and o.name like v_dono::text || '/%'
     and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$';
  v_n := coalesce(array_length(v_arquivos, 1), 0);
  if v_n = 0 then
    raise notice 'E625: nenhuma imagem na pasta da conta de teste. Nada alterado.';
    return;
  end if;

  for v_alvo in
    select * from (values
      ('a0263000-0000-4000-8000-000000000001'::uuid, 'conforto'),
      ('a0269000-0000-4000-8000-000000000001'::uuid, 'premium')
    ) as t(id, alvo)
  loop
    -- só anúncio ativo, do dono de teste, que o motor já deixou em Essencial
    if not exists (
      select 1 from public.properties p join public.imovel_nivel n on n.property_id = p.id
       where p.id = v_alvo.id and p.owner_id = v_dono and p.status::text = 'active' and n.nivel = 'essencial'
    ) then
      continue;
    end if;

    v_chaves := case v_alvo.alvo
      when 'conforto' then array['sono_dois_jogos','sono_dois_travesseiros','ar_quarto_principal','banho_dois_jogos_toalhas','cozinha_microondas','mesa_jantar_todos','sala_assentos','trabalho_mesa_cadeira','lavadora_no_imovel']
      else array['sono_dois_jogos','sono_dois_travesseiros','sono_padrao_hotel','sono_cortina_escura','ar_quarto_principal','ar_todos_quartos','ar_sala','banho_dois_jogos_toalhas','banho_rosto_tapete','cozinha_microondas','mesa_jantar_todos','cozinha_forno','louca_completa','sala_assentos','trabalho_mesa_cadeira','trabalho_cadeira_regulavel','lavadora_no_imovel','lavadora_secadora']
    end;

    -- itens provados por foto (câmera): declarados, foto aceita, sem prazo de refazer
    for v_i in 1 .. array_length(v_chaves, 1) loop
      insert into public.nivel_itens (property_id, chave, declarado, foto_path, foto_status, declarado_por, declarado_em, foto_origem, foto_capturada_em, foto_hash)
      values (v_alvo.id, v_chaves[v_i], true, v_arquivos[1 + ((v_i - 1) % v_n)], 'aceita', v_dono, now(), 'camera', now(),
              'e625e625' || substr(md5(v_chaves[v_i] || v_alvo.id::text), 1, 8))
      on conflict (property_id, chave) do nothing;
    end loop;

    -- ruído: as 4 respostas negativas (classe baixo)
    insert into public.imovel_ruido (property_id, via_intensa, noturno_obra_100m, aviao_ferrovia, isolamento_acustico, classe, origem)
    values (v_alvo.id, false, false, false, false, 'baixo', 'proprietario')
    on conflict (property_id) do nothing;

    -- internet medida no quarto principal e no ponto de trabalho (passa a regra de videochamada), vigente por 6 meses
    insert into public.internet_medicoes (property_id, user_id, papel, download_mbps, upload_mbps, latencia_ms, distancia_m, validada, origem, medido_em, valido_ate, ponto)
    select v_alvo.id, v_dono, 'dono', m.dl, m.ul, m.lat, 0, true, 'cadastro', now(), now() + interval '6 months', m.ponto
      from (values ('quarto_principal', 120.0, 60.0, 18), ('trabalho', 110.0, 55.0, 20)) as m(ponto, dl, ul, lat)
     where not exists (
       select 1 from public.internet_medicoes x
        where x.property_id = v_alvo.id and x.ponto = m.ponto and x.validada and x.valido_ate > now()
     );

    -- o nível que o motor devolve para estas entradas (src/lib/niveis/e625-semente.ts)
    if v_alvo.alvo = 'conforto' then
      v_por_area := '{"sono":"conforto","clima":"conforto","banho":"conforto","cozinha":"conforto","sala":"conforto","trabalho":"conforto","internet":"premium","lavanderia":"conforto","ruido":"premium"}'::jsonb;
      v_dif := '[{"area":"internet","nivel":"premium"},{"area":"ruido","nivel":"premium"}]'::jsonb;
    else
      v_por_area := '{"sono":"premium","clima":"premium","banho":"premium","cozinha":"premium","sala":"premium","trabalho":"premium","internet":"premium","lavanderia":"premium","ruido":"premium"}'::jsonb;
      v_dif := '[]'::jsonb;
    end if;
    update public.imovel_nivel
       set nivel = v_alvo.alvo, por_area = v_por_area, diferenciais = v_dif, ruido_classe = 'baixo', calculado_em = now()
     where property_id = v_alvo.id;
  end loop;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000304', '0304_qa_exemplos_conforto_premium_e625', array['-- conteúdo em supabase/migrations/0304_qa_exemplos_conforto_premium_e625.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000304');
commit;

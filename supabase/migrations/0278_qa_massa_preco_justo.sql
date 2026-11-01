-- 0278 — E399-B parte 1: massa de QA do selo "Preço justo" (só anúncios [TESTE QA] do proprietario1; idempotente).
-- Declara o valor do Airbnb em dois anúncios de teste no ar, os dois com total por mês de R$ 3.350 (R$ 3.200 + contas
-- fixas de R$ 150):
--   • "[TESTE QA] Proativo E264 A" (a0263000-…0001): Airbnb R$ 3.300 — pela regra antiga (valor mensal sem contas, "<")
--     GANHARIA o selo (3.200 < 3.300); pela nova (total ≤ Airbnb) NÃO ganha (3.350 > 3.300). É o bug corrigido.
--   • "[TESTE QA] Proativo E264 B" (a0263000-…0002): Airbnb R$ 3.350 — total igual ao declarado: GANHA o selo ("≤").
-- Só muda airbnb_monthly_price (o selo é a coluna gerada da 0277). Prova: a página de cada anúncio (/imoveis/<id>).
-- Desfazer: supabase/producao/rollback/0278_rollback.sql.
do $$
declare
  v_dono uuid;
begin
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  if v_dono is null then
    raise notice '0278: conta de teste proprietario1 ausente ou não marcada como teste; nada a fazer';
    return;
  end if;
  update public.properties set airbnb_monthly_price = 3300
   where id = 'a0263000-0000-4000-8000-000000000001' and owner_id = v_dono and title = '[TESTE QA] Proativo E264 A';
  update public.properties set airbnb_monthly_price = 3350
   where id = 'a0263000-0000-4000-8000-000000000002' and owner_id = v_dono and title = '[TESTE QA] Proativo E264 B';
end
$$;

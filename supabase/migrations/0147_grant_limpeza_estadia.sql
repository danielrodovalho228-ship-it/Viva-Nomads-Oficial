-- 0147: libera a leitura pública de properties.limpeza_estadia (ordem 4c74ac38, item 3; lab t153 vermelho).
-- A 0053 deixou o SELECT de properties por coluna; a 0144 criou a coluna sem o grant, então a página do anúncio
-- lia NULL e o pacote de limpeza nunca aparecia em "Regras da estadia". Mesmo padrão da 0125.
-- É o mesmo dado que o anúncio já mostra ao público (nada de endereço exato).
grant select (limpeza_estadia) on public.properties to anon, authenticated;

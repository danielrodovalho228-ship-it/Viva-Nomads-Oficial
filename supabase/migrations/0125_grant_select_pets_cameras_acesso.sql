-- Ordem do Moacir (T74 falhou no lab a45a205): a 0053 deixou o SELECT de `properties` por coluna;
-- as colunas de regras de pets (0119) e de câmeras/acesso (0116) nasceram sem esse SELECT,
-- então a página do anúncio lia NULL e nunca mostrava as regras de pets, as câmeras nem o acesso.
-- Só libera leitura de campos que o anúncio já mostra ao público (nada de endereço exato).
grant select (pets_regras, sem_cameras_interior, cameras_externas, tipo_acesso, senha_trocada_estadia)
  on public.properties to anon, authenticated;

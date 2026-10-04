-- ROLLBACK da 0062. ⚠️ REABRE a brecha "qualquer conta vira admin". Só use se
-- algo essencial quebrar e for corrigido logo em seguida.
grant insert, delete on public.profiles to anon, authenticated;

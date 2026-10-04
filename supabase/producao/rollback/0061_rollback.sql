-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK da 0061 (publicar_qualificacao_fotos).
-- ⚠️ Volta o estado quebrado: o site deixa de gravar/ler fotos e o "Salvar
--    qualificação" volta a falhar. As fotos copiadas dos rascunhos e a coluna
--    internet_tier ficam (dados não são apagados).
-- ════════════════════════════════════════════════════════════════════════════
begin;
drop policy if exists "fotos públicas" on public.property_photos;
drop policy if exists "admin lê fotos" on public.property_photos;
drop policy if exists "dono apaga fotos" on public.property_photos;
drop policy if exists "dono grava fotos" on public.property_photos;
drop policy if exists "dono altera fotos" on public.property_photos;
drop policy if exists "espaços de trabalho públicos" on public.property_workspaces;
drop policy if exists "dono gerencia espaços de trabalho" on public.property_workspaces;
alter table public.qualification_checklists
  drop constraint if exists qualification_checklists_internet_tier_check;
commit;

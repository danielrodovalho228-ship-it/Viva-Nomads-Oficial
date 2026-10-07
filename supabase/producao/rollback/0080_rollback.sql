-- Desfaz a 0080: as funções voltam a rodar como quem chama (e a exclusão pelo
-- Auth volta a falhar para donos com fotos).
alter function public.recalc_listing_quality(uuid) security invoker;
alter function public.trg_recalc_listing_quality() security invoker;
grant execute on function public.recalc_listing_quality(uuid) to authenticated;

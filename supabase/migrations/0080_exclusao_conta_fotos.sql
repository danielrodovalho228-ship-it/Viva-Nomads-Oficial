-- 0080 — Exclusão de conta não trava mais nas fotos do anúncio (P1, LGPD).
--
-- Apagar um usuário pelo Auth (auth.admin.deleteUser — usado pelo fluxo
-- público /excluir-conta — ou "Delete user" no painel do Supabase) apaga em
-- cascata os imóveis e as fotos. O gatilho das fotos chamava
-- recalc_listing_quality COMO QUEM APAGA (supabase_auth_admin), que não tem
-- execute nela: "permission denied" e a conta não era excluída.
--
-- Agora as duas rodam com a permissão do dono do banco (SECURITY DEFINER,
-- search_path fixo). Elas só recontam as fotos de UM imóvel e gravam a contagem
-- e o nível do anúncio — nada além disso. recalc_listing_quality deixa de ser
-- chamável pela API (nada no app a chama; só o gatilho).
-- Sem comandos que gerem NOTICE (reaplicar é seguro).

alter function public.recalc_listing_quality(uuid) security definer;
alter function public.recalc_listing_quality(uuid) set search_path = public;
alter function public.trg_recalc_listing_quality() security definer;
alter function public.trg_recalc_listing_quality() set search_path = public;

revoke all on function public.recalc_listing_quality(uuid) from public, anon, authenticated;
revoke all on function public.trg_recalc_listing_quality() from public, anon, authenticated;
grant execute on function public.recalc_listing_quality(uuid) to service_role;

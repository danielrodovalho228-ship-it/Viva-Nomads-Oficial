-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK da 0062 (seguranca_p0). ⚠️ REABRE as brechas (inclusive "qualquer
-- conta vira admin"). Só use se algo essencial quebrar e for corrigido logo.
-- ════════════════════════════════════════════════════════════════════════════
begin;
-- 1
drop trigger if exists trg_profiles_insert_seguro on public.profiles;
drop function if exists public.profiles_insert_seguro();
drop policy if exists "perfil próprio: lê" on public.profiles;
drop policy if exists "perfil próprio: atualiza" on public.profiles;
create policy "perfil próprio" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
grant insert, delete on public.profiles to anon, authenticated;
-- 2
drop policy if exists "proprietario cria resposta" on public.respostas_pedido;
create policy "proprietario cria resposta" on public.respostas_pedido for insert with check (
  proprietario_id = auth.uid()
  and exists (select 1 from public.properties im where im.id = respostas_pedido.imovel_id and im.owner_id = auth.uid() and im.status = 'active')
  and exists (select 1 from public.pedidos_moradia p where p.id = respostas_pedido.pedido_id and p.status = 'ativo'));
drop function if exists public.pedido_ativo(uuid);
-- 3
drop trigger if exists trg_avaliacao_valida on public.avaliacoes;
drop function if exists public.avaliacao_valida();
grant insert on public.avaliacoes to authenticated;
create policy "autor cria avaliação" on public.avaliacoes for insert with check (autor_id = auth.uid());
grant insert, update, delete on public.property_reviews to authenticated;
create policy "dono gerencia avaliações de imóvel" on public.property_reviews for all
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));
-- 4
grant update (avatar_url) on public.profiles to authenticated;
-- 5
drop trigger if exists trg_pedido_moderacao_protegida on public.pedidos_moradia;
drop function if exists public.pedido_moderacao_protegida();
-- 6
grant execute on function public.email_existe(text) to anon, authenticated;
-- 8
drop trigger if exists trg_vistoria_transicao_servidor on public.vistorias;
drop function if exists public.vistoria_transicao_servidor();
drop trigger if exists trg_vistoria_itens_selado on public.vistoria_itens;
drop trigger if exists trg_vistoria_fotos_selado on public.vistoria_fotos;
drop function if exists public.vistoria_filho_selado();
drop policy if exists "vistorias: partes criam" on public.vistorias;
drop policy if exists "vistorias: partes editam rascunho" on public.vistorias;
create policy "vistorias: partes escrevem" on public.vistorias for all to authenticated
  using (public.pode_ver_contrato(contrato_id)) with check (public.pode_ver_contrato(contrato_id));
grant delete on public.vistorias to authenticated;
-- 9
grant select on public.leads to anon, authenticated;
-- 10
drop policy if exists "avatars: dono troca" on storage.objects;
commit;

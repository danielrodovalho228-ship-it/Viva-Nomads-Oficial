-- E1113 (ORDEM-DUET-498 §3; achado K3 da ORDEM-497): a bio do perfil público (profiles.bio) não aceita telefone,
-- e-mail nem mensageiros também no banco. A action (validarBio) já recusa; a RLS "perfil próprio: atualiza" (0062)
-- deixava gravar direto na API. Reusa public.bloqueia_contato_texto da 0057 (regra rigorosa), como o nome
-- (contato_perfil_nome): só na EDIÇÃO — o cadastro (handle_new_user) não pode falhar. Só dispara quando a bio muda.
drop trigger if exists contato_perfil_bio on public.profiles;
create trigger contato_perfil_bio before update of bio on public.profiles
  for each row execute function public.bloqueia_contato_texto('bio', 'rigoroso');

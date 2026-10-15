-- Perfil PÚBLICO do proprietário na página do anúncio (ordem d943f893).
-- A RLS de profiles só deixa cada um ler o próprio perfil, então o visitante nunca via o
-- bloco "Proprietário". Esta função devolve SÓ o que é público — primeiro nome, foto,
-- desde quando anuncia, taxa de resposta e o selo de verificado — e SÓ para anúncio ativo.
-- Nada de sobrenome, e-mail, telefone ou documento.
create or replace function public.perfil_publico_dono(p_imovel uuid)
returns table (nome text, avatar_url text, desde timestamptz, taxa_resposta integer, verificado boolean)
language sql
stable
security definer
set search_path = public
as $$
  select split_part(btrim(coalesce(pr.full_name, '')), ' ', 1) as nome,
         pr.avatar_url,
         pr.created_at as desde,
         pr.response_rate::integer as taxa_resposta,
         coalesce(pr.is_verified, false) as verificado
    from public.properties p
    join public.profiles pr on pr.id = p.owner_id
   where p.id = p_imovel
     and p.status = 'active'
$$;

revoke all on function public.perfil_publico_dono(uuid) from public;
grant execute on function public.perfil_publico_dono(uuid) to anon, authenticated;
comment on function public.perfil_publico_dono(uuid) is 'Perfil público do dono de um anúncio ATIVO: só primeiro nome, foto, desde, taxa de resposta e verificado (0131).';

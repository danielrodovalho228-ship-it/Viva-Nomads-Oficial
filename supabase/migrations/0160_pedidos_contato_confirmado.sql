-- 0160 — Pedido de moradia só aparece para os proprietários depois de e-mail E telefone confirmados
-- (ordem 8dca1437, item 3 do pacote "Próximo do FF" 3/6).
--
-- public.pedidos_publicos_lista() (base do mural e da view pedidos_publicos) passa a listar só pedidos
-- cujo inquilino tem e-mail confirmado (auth.users.email_confirmed_at), telefone confirmado
-- (auth.users.phone_confirmed_at) E a verificação registrada pela Viva (telefone_verificacao.verificado_em,
-- que zera ao trocar de número). Nada mais muda: mesmas colunas, mesma função security definer com
-- search_path fixo, mesmas permissões da 0083. O inquilino continua vendo o próprio pedido em
-- pedidos_moradia. Reaplicar é seguro.

create or replace function public.pedidos_publicos_lista()
returns table (
  id uuid,
  cidade text,
  uf text,
  data_inicio date,
  prazo_meses integer,
  orcamento_mensal numeric(12, 2),
  qtd_ocupantes integer,
  motivo text,
  apresentacao text,
  status text,
  criado_em timestamptz,
  expira_em timestamptz,
  inquilino_verificado boolean,
  pets boolean,
  criancas boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.cidade, p.uf, p.data_inicio, p.prazo_meses, p.orcamento_mensal, p.qtd_ocupantes,
         p.motivo, p.apresentacao, p.status, p.criado_em, p.expira_em,
         coalesce(pf.verification_progress, 0) >= 100,
         p.pets, p.criancas
    from public.pedidos_moradia p
    join public.profiles pf on pf.id = p.inquilino_id
    join auth.users u on u.id = p.inquilino_id
    join public.telefone_verificacao tv on tv.user_id = p.inquilino_id
   where p.status = 'ativo' and p.expira_em > now()
     and u.email_confirmed_at is not null
     and u.phone_confirmed_at is not null
     and tv.verificado_em is not null
$$;
revoke all on function public.pedidos_publicos_lista() from public, anon;
grant execute on function public.pedidos_publicos_lista() to authenticated, service_role;

-- E1112 (ORDEM-DUET-498 §2; achado K1 da ORDEM-497): a página pública do parceiro (/parceiros/<slug>) não aceita
-- telefone, e-mail nem mensageiros no nome, na descrição e na descrição curta. A action salvarPagina já recusa;
-- este gatilho guarda o banco para quem gravar fora dela. Reusa public.bloqueia_contato_texto da 0057 (regra
-- rigorosa, a mesma do nome do perfil). Só na EDIÇÃO: a ativação (insert) copia o pedido aprovado pelo admin e não
-- pode falhar no meio. Só dispara quando o campo muda — páginas que já existem não quebram.
drop trigger if exists contato_parceiro_nome_publico on public.parceiros;
create trigger contato_parceiro_nome_publico before update of nome_publico on public.parceiros
  for each row execute function public.bloqueia_contato_texto('nome_publico', 'rigoroso');
drop trigger if exists contato_parceiro_descricao on public.parceiros;
create trigger contato_parceiro_descricao before update of descricao on public.parceiros
  for each row execute function public.bloqueia_contato_texto('descricao', 'rigoroso');
drop trigger if exists contato_parceiro_descricao_curta on public.parceiros;
create trigger contato_parceiro_descricao_curta before update of descricao_curta on public.parceiros
  for each row execute function public.bloqueia_contato_texto('descricao_curta', 'rigoroso');

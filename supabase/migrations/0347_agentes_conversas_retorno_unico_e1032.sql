-- 0347 (E1032, ORDEM-DUET-171 do Gerente, 19/11/2026): o "Retorno" do Moacir entra uma vez só por ordem.
--
-- O defeito: a Central de agentes chama postarRetornosDoMoacir a cada desenho da página. A função conferia se a
-- mensagem "(ordem <id>)" já existia e só depois inseria; com a Central desenhada duas vezes no mesmo instante (duas
-- sessões, ou dois pedidos da mesma), as duas execuções passavam na conferência e as duas inseriam.
--
-- O remédio: a mensagem de retorno passa a levar a ordem numa coluna própria, com índice único. É o banco que recusa a
-- segunda. O índice é parcial (só linhas com a coluna preenchida): as conversas comuns não são afetadas.
--
-- O que NÃO faz: não preenche nem regrava as linhas que já existem (ficam com a coluna nula, por isso o índice nunca
-- falha por causa delas, mesmo que já haja retornos repetidos) e não apaga nada. Para as ordens antigas continua a
-- valer a conferência pelo texto. Sem chave estrangeira: apagar uma ordem não mexe na conversa. Sem dado pessoal.
alter table public.agentes_conversas add column if not exists retorno_da_ordem uuid;

comment on column public.agentes_conversas.retorno_da_ordem is 'E1032: a ordem (agentes_ordens.id) de que esta mensagem é o Retorno do Moacir. Índice único: um Retorno por ordem. null = conversa comum, ou retorno anterior à 0347.';

create unique index if not exists agentes_conversas_retorno_unico
  on public.agentes_conversas (retorno_da_ordem)
  where retorno_da_ordem is not null;

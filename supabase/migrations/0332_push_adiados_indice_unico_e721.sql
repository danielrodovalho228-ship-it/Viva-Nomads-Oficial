-- E721: "[push] adiar 42P10" — o push adiado (silêncio 22h–7h) dá erro ao agrupar mensagens da mesma conversa.
-- Causa: o `upsert(..., { onConflict: "user_id,grupo" })` do servidor vira `ON CONFLICT (user_id, grupo)`, e o único índice
-- que cobria essas colunas era PARCIAL (`where grupo is not null`, 0226). O Postgres só usa um índice parcial como alvo do
-- ON CONFLICT se o comando repetir o predicado, o que o cliente (PostgREST) não consegue: erro 42P10 ("não há restrição
-- única ou de exclusão que corresponda"), o push não era guardado e o aviso das 7h se perdia.
-- Correção: índice único COMPLETO em (user_id, grupo). Linhas com grupo nulo continuam livres (NULL é distinto em índice
-- único), então a regra é a mesma. Só índice, idempotente, sem tocar em dado.
create unique index if not exists push_adiados_user_grupo on public.push_adiados (user_id, grupo);
drop index if exists public.push_adiados_grupo;

-- 0166 — ia_chamadas.erro_resumo (prompt 25): a MENSAGEM do erro da API (até 300 caracteres), para o diagnóstico
-- não depender de adivinhação (ex.: o 400 invalid_request_error da leitura de documento em 18/10). A API descreve o
-- pedido (parâmetros, schema), nunca o conteúdo do arquivo: sem dado pessoal.
alter table public.ia_chamadas add column if not exists erro_resumo text;
alter table public.ia_chamadas drop constraint if exists ia_chamadas_erro_resumo_tam;
alter table public.ia_chamadas add constraint ia_chamadas_erro_resumo_tam check (erro_resumo is null or char_length(erro_resumo) <= 300);

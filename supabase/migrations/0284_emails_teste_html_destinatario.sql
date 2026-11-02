-- 0284 — E435 (auditoria de links dos e-mails, 02/11): a caixa de e-mails de TESTE guarda também a versão HTML, o
-- destinatário por extenso e o link de descadastro com token, para o leitor de QA (qa_leitor) conferir o que saiu.
-- Só contas de teste são gravadas (guardarNaCaixaTeste); a leitura continua só admin e qa_leitor (RLS da 0136/0246).
-- Nenhum token de ACESSO entra: o HTML passa pela mesma limpeza de links com credencial (E163); o descadastro é o único
-- link com token guardado, à parte, e só desliga e-mails de sugestões da própria conta de teste.
alter table public.emails_teste add column if not exists html text;
alter table public.emails_teste add column if not exists destinatario text;
alter table public.emails_teste add column if not exists descadastro_url text;

comment on column public.emails_teste.html is 'E435: versão HTML do e-mail de teste, sem links com token de acesso (E163).';
comment on column public.emails_teste.destinatario is 'E435: destinatário por extenso (só contas de teste), para o leitor de QA.';
comment on column public.emails_teste.descadastro_url is 'E435: link de descadastro com token (só contas de teste), para o leitor de QA.';

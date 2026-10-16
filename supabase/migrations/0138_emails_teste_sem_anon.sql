-- 0138 — Caixa de e-mails de teste: tira o privilégio padrão do anônimo (ordem 14b71433).
-- A RLS da 0136 já barra a leitura (só admin lê); o revoke tira também o privilégio de tabela do anon.
-- O servidor (service role) segue gravando; o admin (authenticated) segue lendo pela política.
revoke all on public.emails_teste from anon;

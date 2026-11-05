-- 0298 — E482: o aviso do sino ganha uma linha de TEXTO, além do título. O aviso de mensagem nova dizia só "Você tem
-- uma nova mensagem" (sem quem escreveu, sem imóvel, sem prévia). O título continua do catálogo/função pura (sem texto
-- do usuário); a prévia da mensagem (até 140 caracteres, limpa e com o filtro de contato) vai nesta coluna. Nulo nos
-- avisos que não têm texto. Só o servidor (service_role) grava; a pessoa segue só marcando como lido (grant de
-- update só em lido_em, da 0286). Idempotente. Desfazer: supabase/producao/rollback/0298_rollback.sql.
alter table public.avisos add column if not exists texto text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'avisos_texto_curto' and conrelid = 'public.avisos'::regclass) then
    alter table public.avisos add constraint avisos_texto_curto check (texto is null or char_length(texto) <= 200);
  end if;
end
$$;
comment on column public.avisos.texto is 'E482: linha de texto do aviso (ex.: prévia da mensagem, limpa e filtrada). Gravada só pelo servidor.';

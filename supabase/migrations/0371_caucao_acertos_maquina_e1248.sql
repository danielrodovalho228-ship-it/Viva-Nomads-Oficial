-- 0371 (E1248, ESPEC-E1248 v11, secções 3.6 e 9-A; ORDEM-DUET 1355 do Gerente, 28/11/2026): a máquina da devolução da
-- caução guarda em caucao_acertos o aviso ao morador, o lembrete, como foi confirmada, a contestação com o motivo, o
-- chamado da Central, a decisão dela e o comprovante da transferência (o caminho no bucket da conferência, com a hora do
-- pedido, do anexo e do lembrete). O estado continua com os quatro valores da 0036; confirmado_em passa a guardar a hora
-- da confirmação nas três formas.
-- O que NÃO faz: não grava nem regrava linha nenhuma (as que existem ficam com as colunas novas vazias, e um acerto sem a
-- hora do aviso nunca é confirmado por falta de resposta); não cria bucket (o comprovante vai no da conferência, 0117);
-- não muda a política nem a RLS da tabela (a leitura do comprovante tem autorização própria, no servidor); não toca em
-- caucao_prazos (a suspensão do PR 2 lê contestado_em e central_decidido_em). Sem dado pessoal.
-- Rollback: supabase/producao/rollback/0371_rollback.sql (com dados nas colunas novas, falha sem mudar nada).
alter table public.caucao_acertos
  add column if not exists aviso_em timestamptz,
  add column if not exists lembrete_em timestamptz,
  add column if not exists confirmacao_via text,
  add column if not exists contestacao_motivo text,
  add column if not exists contestado_em timestamptz,
  add column if not exists chamado_id uuid references public.chamados (id) on delete set null,
  add column if not exists central_decisao text,
  add column if not exists central_decidido_em timestamptz,
  add column if not exists central_decidido_por uuid references auth.users (id) on delete set null,
  add column if not exists central_motivo text,
  add column if not exists comprovante_path text,
  add column if not exists comprovante_pedido_em timestamptz,
  add column if not exists comprovante_anexado_em timestamptz,
  add column if not exists comprovante_lembrete_em timestamptz;

-- As regras, com nome (o rollback tira-as pelo nome). Cada uma entra só se ainda não existir.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'caucao_acertos_confirmacao_via_chk' and conrelid = 'public.caucao_acertos'::regclass) then
    alter table public.caucao_acertos add constraint caucao_acertos_confirmacao_via_chk
      check (confirmacao_via is null or confirmacao_via in ('morador', 'falta_de_resposta', 'central'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'caucao_acertos_central_decisao_chk' and conrelid = 'public.caucao_acertos'::regclass) then
    alter table public.caucao_acertos add constraint caucao_acertos_central_decisao_chk
      check (central_decisao is null or central_decisao in ('confirmada', 'nao_confirmada'));
  end if;
  -- a decisão e a hora dela andam juntas
  if not exists (select 1 from pg_constraint where conname = 'caucao_acertos_decisao_e_hora_chk' and conrelid = 'public.caucao_acertos'::regclass) then
    alter table public.caucao_acertos add constraint caucao_acertos_decisao_e_hora_chk
      check ((central_decisao is null) = (central_decidido_em is null));
  end if;
  -- "não confirmada" exige o motivo (5 letras ou mais, a regra do E1229)
  if not exists (select 1 from pg_constraint where conname = 'caucao_acertos_nao_confirmada_motivo_chk' and conrelid = 'public.caucao_acertos'::regclass) then
    alter table public.caucao_acertos add constraint caucao_acertos_nao_confirmada_motivo_chk
      check (central_decisao is distinct from 'nao_confirmada' or char_length(btrim(coalesce(central_motivo, ''))) >= 5);
  end if;
  -- a contestação COM HORA exige o motivo, de 5 a 500 letras: por hora, e não por estado (um acerto contestado antes da
  -- 0371 não tem motivo, e a regra não o pode apanhar); sem hora, o motivo, se houver, também não passa de 500
  if not exists (select 1 from pg_constraint where conname = 'caucao_acertos_contestacao_motivo_chk' and conrelid = 'public.caucao_acertos'::regclass) then
    alter table public.caucao_acertos add constraint caucao_acertos_contestacao_motivo_chk
      check (
        (contestado_em is null and (contestacao_motivo is null or char_length(contestacao_motivo) <= 500))
        or (contestado_em is not null and char_length(btrim(coalesce(contestacao_motivo, ''))) between 5 and 500)
      );
  end if;
  -- o caminho no formato dos da conferência: a pasta de quem enviou e um arquivo PDF ou imagem
  if not exists (select 1 from pg_constraint where conname = 'caucao_acertos_comprovante_path_chk' and conrelid = 'public.caucao_acertos'::regclass) then
    alter table public.caucao_acertos add constraint caucao_acertos_comprovante_path_chk
      check (comprovante_path is null or comprovante_path ~ '^[0-9a-zA-Z-]+/[0-9a-zA-Z_-]+\.(pdf|jpg|png|webp)$');
  end if;
end $$;

-- Os dois índices da rotina de hora a hora: os acertos à espera com o aviso enviado (o silêncio e o lembrete); e os
-- pedidos de comprovante sem anexo e sem decisão (o lembrete do anexo).
create index if not exists caucao_acertos_espera_aviso_idx on public.caucao_acertos (aviso_em)
  where status = 'aguardando_confirmacao' and aviso_em is not null;
create index if not exists caucao_acertos_comprovante_pendente_idx on public.caucao_acertos (comprovante_pedido_em)
  where comprovante_pedido_em is not null and comprovante_anexado_em is null and central_decisao is null;

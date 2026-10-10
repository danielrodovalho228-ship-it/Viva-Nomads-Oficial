-- 0097 — CENTRAL v2, PR A parte 1 (ordem 34f2b39d): bucket PRIVADO "central-anexos" para anexos do chat dos agentes.
-- APLICADA PELO MERGE. Sem política para anon/authenticated: o arquivo entra e sai só pelo servidor
-- (service role), que confere se quem chama é admin e devolve URL assinada de 10 min.
-- Imagem, PDF, planilha (xlsx/csv), docx e áudio, até 20 MB. Só cria coisa nova. Sem DROP, sem dado pessoal.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'central-anexos', 'central-anexos', false, 20971520,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'
  ]
)
on conflict (id) do nothing;

-- Guarda o CAMINHO (não a URL) do documento do imóvel (matrícula / contrato de
-- gestão) enviado na qualificação. O arquivo vive no bucket PRIVADO
-- `property-docs` (public=false, RLS por dono — migration 0032); aqui fica só a
-- referência estável, e a exibição usa URL assinada com expiração. Nunca uma
-- URL pública.
alter table public.qualification_checklists
  add column if not exists document_path text;

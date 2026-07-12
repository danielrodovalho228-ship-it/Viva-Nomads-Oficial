-- ── 0044 — conferência do documento do imóvel (anti-fraude, 2ª camada) ──
-- Fecha a fila de moderação (Moacir): impressão digital do arquivo para detectar
-- REUSO do mesmo documento entre contas, e o carimbo de quando foi enviado
-- (distinto do created_at da linha de qualificação).
alter table public.qualification_checklists
  add column if not exists document_hash_sha256 text,
  add column if not exists document_uploaded_at timestamptz;

-- Índice para achar o mesmo arquivo em cadastros diferentes (sinal de fraude:
-- uma matrícula reaproveitada em várias contas). Parcial — só hashes presentes.
create index if not exists qualification_checklists_doc_hash_idx
  on public.qualification_checklists (document_hash_sha256)
  where document_hash_sha256 is not null;

-- Requeue: os documentos JÁ aprovados voltam para a fila ('pending') para uma
-- reconferência com os novos controles (impressão digital + checklist de
-- conferência). Não toca em 'none' nem 'rejected'. Anúncios já publicados
-- seguem no ar — o portão de Publicar só vale para novas publicações.
update public.qualification_checklists
set document_status = 'pending',
    document_reviewed_at = null,
    document_reviewed_by = null,
    document_review_reason = null
where document_status = 'approved';

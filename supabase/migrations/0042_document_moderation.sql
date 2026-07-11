-- ═══════════════════════════════════════════════════════════════════════════
-- Verificação do documento do imóvel (anti-fraude, item 1 do QA do editor).
--
-- O upload da matrícula NÃO aprova automaticamente. O documento entra "em
-- análise" (pending) e um admin aprova/recusa (com motivo) numa fila de
-- moderação. Só aprovado libera PUBLICAR. Estado mora na própria linha de
-- qualificação (que já guarda document_path — migration 0041).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.qualification_checklists
  add column if not exists document_status text
    not null default 'none'
    check (document_status in ('none', 'pending', 'approved', 'rejected')),
  add column if not exists document_review_reason text,
  add column if not exists document_reviewed_at timestamptz,
  add column if not exists document_reviewed_by uuid references auth.users (id);

comment on column public.qualification_checklists.document_status is
  'Estado da verificação do documento: none|pending|approved|rejected. Só approved libera publicar.';

-- Admin lê TODAS as qualificações (fila de moderação) e atualiza o status.
-- (O dono já lê/insere as próprias pela RLS existente.)
drop policy if exists "qualif: admin lê" on public.qualification_checklists;
create policy "qualif: admin lê"
  on public.qualification_checklists for select to authenticated
  using (public.is_admin());

drop policy if exists "qualif: admin modera" on public.qualification_checklists;
create policy "qualif: admin modera"
  on public.qualification_checklists for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Índice para a fila (documentos aguardando análise).
create index if not exists qualification_checklists_doc_status_idx
  on public.qualification_checklists (document_status)
  where document_status = 'pending';

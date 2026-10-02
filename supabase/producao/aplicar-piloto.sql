-- ═══════════════════════════════════════════════════════════════════════
-- APLICAR EM PRODUÇÃO — bloco do piloto (moderação + #212).
-- Gerado a partir dos arquivos reais de migração (sem divergência).
--
-- ORDEM E O QUE CONFERIR estão em supabase/producao/CHECKLIST.md.
-- ⚠️  0044 tem um UPDATE de REQUEUE (approved → pending) que só deve rodar
--     UMA vez. Se 0044 JÁ foi aplicada antes, NÃO re-rode a parte do UPDATE
--     (as adições de coluna são idempotentes; o UPDATE re-enfileiraria
--     documentos aprovados de novo). Rode o CHECK antes: npm run check:migracoes
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────── 0042 (moderação: document_status + RLS) ───────────────
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

-- ─────────────── 0044 (hash + reviewed_by + requeue ⚠️) ───────────────
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

-- ─────────────── 0046 (#212 — aceite persistido + snapshot comissão) ───
-- ACEITE PERSISTIDO DA CANDIDATURA (P0 — espinha do marketplace).
--
-- Até aqui, "aprovar/recusar" um interessado vivia só no estado do cliente
-- (some no refresh) e não ancorava nada. Agora o aceite PERSISTE no servidor,
-- é a autoridade da revelação de identidade (nome + foto + verificação — NUNCA
-- e-mail/telefone) e CONGELA a comissão do plano vigente NA DATA DO ACEITE
-- (regra anti-relâmpago: upgrade vale para aceites futuros, downgrade não
-- retroage). O fechamento herda esse snapshot.
--
-- Vocabulário do status (fonte da verdade no servidor):
--   'new'      → candidatura em aberto (inquilino vê "Enviada"/"Em análise")
--   'accepted' → proprietário aceitou  (inquilino vê "Aceita")
--   'rejected' → proprietário recusou  (inquilino vê "Não seguiu adiante")
-- 'new' legado permanece intacto.

alter table public.leads
  add column if not exists accepted_at              timestamptz,
  add column if not exists rejected_at              timestamptz,
  add column if not exists reject_reason            text,
  add column if not exists decided_by               uuid references public.profiles (id),
  -- Snapshot do plano e da comissão (0..1) do PROPRIETÁRIO no instante do aceite.
  add column if not exists accepted_plan            text,
  add column if not exists accepted_commission_rate numeric(5, 4);

-- O DONO do lead pode transicionar o próprio lead (aprovar/recusar). A leitura
-- já é coberta por "leads das partes"; o INSERT, por "inquilino cria lead".
-- Sem esta policy a RLS bloquearia o UPDATE e o aceite não persistiria.
drop policy if exists "dono decide candidatura" on public.leads;
create policy "dono decide candidatura" on public.leads
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create index if not exists leads_owner_status_idx on public.leads (owner_id, status);
create index if not exists leads_tenant_status_idx on public.leads (tenant_id, status);

-- ─────────────── 0047 (#212 — account_type + auditoria) ───────────────
-- ESCADA DE PLANOS — Gestor por ELEGIBILIDADE (não de prateleira).
--
-- O plano Gestor não é auto-serviço: só entra para quem é elegível — conta do
-- tipo 'gestor' (administradora, marcada por admin) OU 5+ imóveis com
-- documentação APROVADA. Aqui persistimos o tipo de conta e AUDITAMOS toda
-- mudança (quem mudou, de quê para quê, quando e por quê) — decisão sensível
-- de acesso comercial.

alter table public.profiles
  add column if not exists account_type text not null default 'individual'
    check (account_type in ('individual', 'gestor'));

-- Trilha de auditoria das mudanças de tipo de conta (só admin escreve/lê).
create table if not exists public.account_type_audit (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  old_type text,
  new_type text not null,
  changed_by uuid references public.profiles (id),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.account_type_audit enable row level security;

-- Só admin lê a trilha (is_admin() já existe — 0011). A escrita é feita por
-- server action com service role (admin client), então não abrimos INSERT via RLS.
drop policy if exists "admin lê auditoria de conta" on public.account_type_audit;
create policy "admin lê auditoria de conta" on public.account_type_audit
  for select using (public.is_admin());

create index if not exists account_type_audit_profile_idx
  on public.account_type_audit (profile_id, created_at desc);

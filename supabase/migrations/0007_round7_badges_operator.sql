-- ─────────────────────────────────────────────────────────────
-- Rodada 7 — família de selos em camadas + perfil operador
-- ─────────────────────────────────────────────────────────────

-- Atualização 11 — selo base "Pronto para Morar" + etiquetas de aptidão.
-- Substitui o antigo "Pronto para Trabalho" (work_score / work_ready_badge),
-- que permanece na tabela por compatibilidade mas deixa de ser usado.
alter table properties
  add column ready_to_live_badge boolean not null default false, -- selo "Pronto para Morar"
  add column ready_to_live_score int not null default 0
    check (ready_to_live_score between 0 and 100),
  add column tag_home_office boolean not null default false,   -- "Para trabalhar de casa"
  add column tag_work_located boolean not null default false,  -- "Bem localizado p/ trabalho"
  add column tag_condo_approved boolean not null default false; -- "Aceito em condomínio"

alter table qualification_checklists
  add column ready_to_live_badge boolean not null default false,
  add column ready_to_live_score int not null default 0
    check (ready_to_live_score between 0 and 100),
  add column tag_home_office boolean not null default false,
  add column tag_work_located boolean not null default false,
  add column tag_condo_approved boolean not null default false;

-- Atualização 12 — distinção próprio vs. operado (sublocação autorizada).
create type ownership_type as enum ('own', 'subleased');

alter table properties
  add column ownership_type ownership_type not null default 'own',
  add column sublease_authorized boolean not null default false, -- exigido p/ publicar operado
  add column sublease_doc_url text;                              -- autorização do proprietário

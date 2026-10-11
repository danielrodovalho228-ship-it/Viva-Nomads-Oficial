-- 0105 — AVISOS SÓ PARA O DANIEL (ordem 27cfd36a). Separa dois tipos de aviso aos admins.
-- Por quê: pushParaAdmins mandava os avisos do Moacir e as decisões de CEO para TODOS os admins; com o Rogério admin, ele passaria a recebê-los.
--  • recebe_avisos_ceo: avisos do Moacir e aprovações de decisão do CEO. Padrão false; só o dono liga.
--  • recebe_alertas_operacionais: documento na fila, chamado, parceiro em análise. Padrão false; cada admin liga na Conta.
-- Segurança: o UPDATE de profiles por authenticated só vale nas colunas liberadas (0052/0062), então estas colunas NÃO podem ser alteradas
-- pelo próprio usuário; a Conta grava as operacionais por Server Action com service_role depois de checar role = 'admin'. Sem dado pessoal. Idempotente.
-- Backfill: o admin mais antigo (o Daniel, primeiro admin) liga as duas; novos admins nascem desligados.

alter table public.profiles add column if not exists recebe_avisos_ceo boolean not null default false;
alter table public.profiles add column if not exists recebe_alertas_operacionais boolean not null default false;

comment on column public.profiles.recebe_avisos_ceo is 'Avisos do Moacir e decisões de CEO (push). Só o dono; não editável pelo usuário.';
comment on column public.profiles.recebe_alertas_operacionais is 'Alertas operacionais (documento na fila, chamado, parceiro). O admin liga na Conta.';

update public.profiles p
   set recebe_avisos_ceo = true, recebe_alertas_operacionais = true
 where p.id = (select id from public.profiles where role = 'admin' order by created_at asc limit 1)
   and not exists (select 1 from public.profiles where recebe_avisos_ceo);

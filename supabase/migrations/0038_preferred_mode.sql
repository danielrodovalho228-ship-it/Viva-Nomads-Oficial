-- ══════════════════════════════════════════════════════════════════════════
-- Modo ativo (proprietário ⇄ inquilino) como PREFERÊNCIA DE PERFIL (B1).
--
-- Até aqui o "modo" era só estado de cliente (localStorage do zustand). Isso
-- fazia o modo "escorregar" entre abas/dispositivos e — pior — um deep-link a
-- uma rota exclusiva de proprietário podia abrir na visão de inquilino e ser
-- redirecionado. Agora o modo vira coluna do perfil: alternar grava no servidor
-- e refresh / nova aba / outro dispositivo mantêm a escolha.
--
-- A RLS já existente de `profiles` ("perfil próprio" para update) governa a
-- escrita: cada pessoa só grava o próprio `preferred_mode`. Nada de novo aqui.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists preferred_mode text
    check (preferred_mode in ('owner', 'tenant'));

comment on column public.profiles.preferred_mode is
  'Último mundo escolhido no seletor (owner|tenant). NULL = derivar do papel de cadastro.';

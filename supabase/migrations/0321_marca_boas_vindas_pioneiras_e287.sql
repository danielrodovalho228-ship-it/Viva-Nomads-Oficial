-- 0321 (E287, ordem do Daniel de 07/11/2026): grava a marca de boas-vindas nas contas das duas únicas usuárias REAIS da
-- Viva Nomads, para o automático da plataforma não duplicar o boas-vindas depois que o e-mail manual das pioneiras sair.
-- É a MESMA marca que enviarBoasVindas grava (src/lib/notifications/boas-vindas-servidor.ts): automacoes_envios,
-- chave 'boas_vindas:<id da conta>', tipo 'boas_vindas', usuario_id = id da conta. Nenhum e-mail é enviado aqui.
--
-- Contas (achadas por e-mail E papel em profiles; nunca por id colado):
--   1. Maria de Fátima — fatima.alves.campanha@gmail.com — proprietária (role = 'owner')
--   2. Lya Raquel      — lyamercaldi@gmail.com           — inquilina (role = 'tenant')
-- Se nenhuma das duas existir (laboratório, banco novo), avisa e segue sem gravar. Se alguma existir mas as duas não conferirem
-- (falta uma, outro papel, conta de teste), a migração PARA (exceção) e não grava nada.
-- Se a marca já existir, não duplica (a chave é a chave primária). Nenhuma outra conta é tocada.
do $$
declare
  existentes integer;
  achadas integer;
begin
  -- Banco sem nenhuma das duas contas (laboratório, CI, banco novo): não há o que marcar. Avisa e segue, sem gravar.
  select count(*) into existentes
    from public.profiles p
   where lower(p.email) in ('fatima.alves.campanha@gmail.com', 'lyamercaldi@gmail.com');
  if existentes = 0 then
    raise notice 'E287: nenhuma das duas contas existe neste banco — nada a marcar (laboratório ou banco novo)';
    return;
  end if;

  -- Alguma existe: então as DUAS têm de conferir por e-mail e papel; se não, PARA (exceção) e não grava nada.
  select count(*) into achadas
    from public.profiles p
   where p.is_teste is not true
     and ((lower(p.email) = 'fatima.alves.campanha@gmail.com' and p.role = 'owner')
       or (lower(p.email) = 'lyamercaldi@gmail.com' and p.role = 'tenant'));
  if achadas <> 2 then
    raise exception 'E287: esperava 2 contas reais (Maria de Fátima, proprietária; Lya Raquel, inquilina) e achei % — nada foi gravado', achadas;
  end if;

  insert into public.automacoes_envios (chave, tipo, usuario_id)
  select 'boas_vindas:' || p.id::text, 'boas_vindas', p.id
    from public.profiles p
   where p.is_teste is not true
     and ((lower(p.email) = 'fatima.alves.campanha@gmail.com' and p.role = 'owner')
       or (lower(p.email) = 'lyamercaldi@gmail.com' and p.role = 'tenant'))
  on conflict (chave) do nothing;
end $$;

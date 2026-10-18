-- 0167 — identidade: laudos JÁ GRAVADOS passam a valer 12 meses (prompt 25; decisão do Daniel em 18/10).
-- Os laudos de antes do #838 foram gravados com criação + 90 dias ("até 16/01/2027"). Só estende os que ainda valem
-- (valid_until > agora) — laudo vencido ou invalidado por troca de nome/CPF (0164: valid_until = now()) fica como está.
update public.tenant_verifications
   set valid_until = created_at + interval '12 months'
 where valid_until is not null
   and valid_until < created_at + interval '12 months'
   and valid_until > now();

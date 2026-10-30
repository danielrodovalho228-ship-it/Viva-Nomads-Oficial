-- 0265 (QA, E283-B) — prova ao vivo do caso C do boas-vindas de dono: zera SÓ a intenção da Ana Teste Inquilina
-- (inquilino2, conta de teste), que hoje tem intencao = ['anunciar'] gravada pelo rascunho de 30/10 (antes do E283-B).
-- Com a intenção vazia, o próximo rascunho dela registra "anunciar" de novo e — pelo critério do E283-B — manda o
-- boas-vindas de dono (ela nunca recebeu nenhum: não há chave boas_vindas:<conta>). Não mexe em papel_ativo, modo,
-- role, rascunhos nem em qualquer outra conta. Só age se a conta for de teste.
update public.profiles
   set intencao = null
 where id = '3555816b-7100-4301-94a4-aec9eeccf991'
   and email = 'inquilino2@vivanomads.com.br'
   and is_teste is true;

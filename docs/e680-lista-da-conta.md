# E680 — a lista de estadias de uma conta nunca mostra estadia de outra

**Relato (07/11):** uma estadia alheia piscou em "Suas estadias" do morador; a página dela deu 404 para as duas contas.

**Leitura do código (sem prova ao vivo):**
- As duas listas do servidor já filtram pela sessão do pedido: `estadiasDaHome` (contratos com `tenant_id` = eu ou imóvel meu) e `getMinhasLocacoes` (`tenant_id` = eu, com RLS). Nenhuma delas passa por cache compartilhado (`unstable_cache` só existe no admin) e o cliente não guarda contratos em store persistido.
- Uma lista pode, porém, chegar a um navegador que já está com OUTRA conta: troca de conta no mesmo navegador (a mesma causa do E674: o cookie e o `localStorage` da conta anterior), página guardada ou resposta atrasada de antes da troca. A página da estadia, pedida depois, sai com a sessão nova e dá 404, porque o contrato não é de nenhuma das duas contas daquele momento.

**Correção (sem migração):** cada lista leva `paraUsuario` (a conta para quem o servidor a montou) e o cliente só a mostra se for a conta que está no navegador (`soDaConta`, `src/lib/sessao/lista-da-conta.ts`). Vale para "Suas estadias" da home e para "Minhas estadias". Enquanto o navegador ainda não sabe quem é, vale a lista do servidor.

**Teste:** `src/lib/sessao/e680-lista-da-conta.test.ts` (escrito antes, visto vermelho).

**Dúvida:** não reproduzi ao vivo. Se a QA ainda vir estadia alheia depois do deploy, falta o horário e se houve troca de conta (porta de QA) antes.

**Observação:** `tsc` na main está vermelho em `src/lib/estadia/instrucoes.ts` (mapa de grupos incompleto): é o que o #3164 corrige; não é deste PR.

## Evidência do banco (leitura, 07/11, sem escrita)

O id citado (`2d7b24ba-cb32-47d1-bfbb-bc8a9ba1cb5e`) **não existe** hoje em `contratos`, `properties`, `leads` nem `propostas`. O nome "[TESTE QA] Resumo semanal 0276 A" é o título de um **imóvel** da massa 0276 (`a0276a00-…`), que não tem nenhum contrato; a migração 0276 não cria contrato. O inquilino1 tem 3 contratos ativos, nenhum nesse imóvel.

Leitura: o 404 "para as duas contas" é coerente com um contrato que já não existe (apagado numa limpeza/redefinição de massa de QA depois da renderização). A lista do servidor (`estadiasDaHome`, `getMinhasLocacoes`) filtra por `tenant_id`/imóveis da própria sessão; a defesa de cliente deste PR (`soDaConta`) cobre a lista que chega a um navegador já em outra conta. Sem outra causa no código. Se a QA ver de novo: horário, e se a massa foi redefinida antes.

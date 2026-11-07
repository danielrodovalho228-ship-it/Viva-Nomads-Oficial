# E680 — a lista de estadias de uma conta nunca mostra estadia de outra

**Relato (07/11):** uma estadia alheia piscou em "Suas estadias" do morador; a página dela deu 404 para as duas contas.

**Leitura do código (sem prova ao vivo):**
- As duas listas do servidor já filtram pela sessão do pedido: `estadiasDaHome` (contratos com `tenant_id` = eu ou imóvel meu) e `getMinhasLocacoes` (`tenant_id` = eu, com RLS). Nenhuma delas passa por cache compartilhado (`unstable_cache` só existe no admin) e o cliente não guarda contratos em store persistido.
- Uma lista pode, porém, chegar a um navegador que já está com OUTRA conta: troca de conta no mesmo navegador (a mesma causa do E674: o cookie e o `localStorage` da conta anterior), página guardada ou resposta atrasada de antes da troca. A página da estadia, pedida depois, sai com a sessão nova e dá 404, porque o contrato não é de nenhuma das duas contas daquele momento.

**Correção (sem migração):** cada lista leva `paraUsuario` (a conta para quem o servidor a montou) e o cliente só a mostra se for a conta que está no navegador (`soDaConta`, `src/lib/sessao/lista-da-conta.ts`). Vale para "Suas estadias" da home e para "Minhas estadias". Enquanto o navegador ainda não sabe quem é, vale a lista do servidor.

**Teste:** `src/lib/sessao/e680-lista-da-conta.test.ts` (escrito antes, visto vermelho).

**Dúvida:** não reproduzi ao vivo. Se a QA ainda vir estadia alheia depois do deploy, falta o horário e se houve troca de conta (porta de QA) antes.

**Observação:** `tsc` na main está vermelho em `src/lib/estadia/instrucoes.ts` (mapa de grupos incompleto): é o que o #3164 corrige; não é deste PR.

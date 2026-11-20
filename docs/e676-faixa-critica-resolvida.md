# E676 — a faixa de crítico some quando o problema se resolve

**Relato (07/11, retomada do E652):** "Assinar o contrato" seguiu no painel do Lucas depois do contrato assinado pelos dois;
"Proposta de alteração da estadia" seguiu no painel/listas do Paulo depois do Aditivo 1 assinado pelos dois.

**Evidência (somente leitura da produção):** na tabela `avisos` há um crítico `estadia_aditivo_proposto` **sem `ref_id`** e
não resolvido; o crítico `contract_status` do mesmo dia está resolvido.

**Causas:**
1. Os avisos da estadia (`avisar`) eram gravados sem `ref_id`, e o resolvedor (`resolverAvisos`) casa por `ref_id`; além
   disso nada resolvia o aviso quando o aditivo era respondido ou assinado.
2. A faixa só olhava `resolvido_em`: um aviso que a ação não marcou (antigo, sem `ref_id`, ou gravado depois da ação)
   ficava para sempre. O rótulo "Assinar o contrato" vem do evento, não do estado.

**Correção (sem migração):**
- `avisar` grava `refId` = contrato; responder o aditivo resolve o aviso de quem respondeu; a assinatura completa do aditivo
  resolve o dos dois; a segunda assinatura do contrato resolve o crítico `contract_status` da outra parte também.
- A rota `/api/painel/avisos` confere a situação real (`situacaoDosContratos`: contrato ainda sem a assinatura da pessoa;
  aditivo `proposto` e dentro da validade) e trata como resolvido o crítico cujo problema já não existe
  (`resolvidosNaPratica`). Vale também para os avisos antigos (o contrato sai do `ref_id` ou do endereço do aviso). Se a
  leitura falha, nada é escondido.

**Teste:** `src/lib/notifications/e676-faixa-resolvida.test.ts` (escrito antes, visto vermelho).

**Dúvida:** o aviso antigo continua com `resolvido_em` nulo no banco (a RLS só deixa a pessoa marcar `lido_em`); ele só
deixa de aparecer na faixa e no selo. Se quiser limpar os antigos no banco, é uma migração de dados à parte.

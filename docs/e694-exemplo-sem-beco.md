# E694 — Anúncio de exemplo não é beco sem saída (candidatura e mensagem)

**Relato (QA Allinne, 07/11):** numa conta real todos os imóveis da busca são "de exemplo"; a candidatura andava até o passo 3 "Confirmar candidatura" e lá só havia "Voltar" (o aviso de demonstração aparecia só no fim); o "Enviar" da mensagem ao proprietário não dava retorno.

**Causa (código):** `property-detail.tsx` tratava o exemplo só no fim — o aviso `solicitacao-demo` ficava no rodapé do modal, o "Continuar" levava aos passos 2 e 3, e a mensagem deixava digitar e só avisava depois do "Enviar".

**Correção (sem migração, só `property-detail.tsx`):**
- Candidatura: o aviso "Demonstração: este anúncio é de exemplo e a solicitação não é enviada." vem logo sob o título, antes de qualquer campo; no exemplo não há barra de passos nem "Continuar"; sobra o resumo (que mostra como o pedido ficaria) e o "Entendi".
- Mensagem: o aviso "Este anúncio é de exemplo: nenhuma mensagem é enviada" vem ANTES da caixa; a caixa e o "Enviar" ficam desligados; o botão vira "Entendi".
- Imóvel real: nada muda.

**Teste:** `src/components/property/e694-exemplo-sem-beco.test.ts` (visto vermelho antes). E2E ajustado: `t130` (mensagem no exemplo). `t132`, `t155` e `t262` seguem válidos (o aviso `solicitacao-demo` e o "Entendi" continuam; o "Continuar" não era exercitado no exemplo).

**Fora desta correção:** a busca de uma conta real mostrar só imóveis de exemplo é decisão de produto (`NEXT_PUBLIC_SHOW_DEMO_PROPERTIES`, variável da Vercel — não mexo).

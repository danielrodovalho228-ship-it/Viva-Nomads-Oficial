# E878 — cadastro de parceiro sem prazo de ativação, sem lista completa de documentos e sem dizer se há contrato

**Achado:** o formulário prometia CNPJ (sem CPF), a conferência (identidade/CNPJ; portfólio na fotografia; empresa e veículo na mudança) e a resposta em até 7 dias com o link. Não dizia quando a página entra no ar depois da aprovação, a lista completa do que o pedido leva, nem se há contrato. Família E818/E827/E865.

## O que o código faz de verdade (lido, sem prova ao vivo)
- **Pedido:** `validarSolicitacao` (servidor) exige CNPJ válido (só PJ, E648), nome, e-mail confirmado e telefone, categorias, cidades e o item da categoria (portfólio, empresa+veículo ou descrição). O admin confere pelo `CHECKLIST_PARCERIA`: identidade (CAF ou manual), CNPJ na Receita, área e item da categoria.
- **Aprovação:** `admin-actions` grava o token de ativação, válido por `DIAS_TOKEN` = 7 dias. O e-mail traz o link, e dá para ativar pelo painel com a conta do pedido (E425).
- **Ativação:** é imediata (`ativacao-nucleo`) e cria a página em **rascunho**. O parceiro completa e **publica ele mesmo** (`publicarPagina`), sem nova análise, quando `faltaParaPublicar` não cobra mais nada: foto de perfil, descrição (30+), 1 serviço, 1 cidade, 3 fotos na galeria (fotografia) e a resposta sobre nota fiscal.
- **Contrato:** não existe contrato de parceria no código (nem texto, nem assinatura). O aceite do formulário é só a autorização para usar os dados na análise.

## Correção
`src/lib/parceiros/regras.ts`:
- `DOCUMENTOS_DO_PEDIDO`: a lista completa do pedido;
- `DEPOIS_DA_APROVACAO`: o link de 7 dias (ou o painel), a ativação na hora com a página em rascunho, o que falta para publicar e "Não há contrato separado para assinar".

As duas listas aparecem no formulário, antes do botão de enviar (`data-testid="seja-parceiro-expectativa"`). Os números vêm das constantes (`DIAS_TOKEN`, `FOTOS_MIN_FOTOGRAFIA`).

## Testes
- `node --test src/lib/parceiros/e878-expectativa-cadastro.test.ts`: main pass 0 / fail 1; branch pass 3 / fail 0. Ele confere que o texto "o que falta para publicar" bate com o que `faltaParaPublicar` cobra de uma página vazia de fotografia.
- Escopados (`src/lib/parceiros`, estilo): 0 falhas. tsc limpo; consistência OK.
- Lab (build da branch, depois de religar o Supabase local que tinha caído): t1612 + t236 → 9 passed, 1 failed, 11 não rodaram (serial).
  - Passaram os cenários do formulário, inclusive o pedido de fotografia com o e-mail "Recebemos o seu pedido".
  - Falhou a etapa do admin (`ficha-parceria` não apareceu na lista do admin), tela que este PR não toca. Não rodei na main.

## Dúvidas
- "Não há contrato separado" descreve o código de hoje. Se a Viva for ter um termo de parceria, o texto muda junto.
- Proposta: o e-mail de aprovação também poderia trazer a lista "depois da aprovação". Não mexi.

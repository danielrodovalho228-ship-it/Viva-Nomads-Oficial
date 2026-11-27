# E672 — remarcação com dias exatos e comparativo completo

**Relato (07/11, retomada do E652):** `/alteracao` pedia só a data de entrada; o pedido, o comparativo do dono e o Aditivo 1
mostravam só "Entrada: de 10/01/2027 para 17/01/2027" e "Taxa de serviço do aditivo: sem alteração" — sem dias, saída,
novo total nem diferença.

**Correção (sem migração):**
- `comparativoDoAditivo` (aditivo.ts): antes × depois com entrada, saída (fim gravado, como a página do contrato — E671),
  dias exatos (início ao fim, inclusive: 2 meses = 60) e total (soma dos blocos), mais a diferença (positivo = a pagar a
  mais; negativo = a devolver).
- A proposta grava o comparativo e o motivo em `contrato_aditivos.mudancas` (jsonb, já existente). O resumo (página, pedido,
  e-mail) e o texto assinado (`linhasDoAditivo`, base do hash) passam a trazer: Saída, Dias, Total, Diferença e Motivo.
  Aditivo antigo, sem comparativo, mantém o texto de antes.
- Formulário: mostra a saída e os dias calculados pela entrada e pelos meses, e ganha o campo "Motivo (opcional)".

**Teste:** `src/lib/estadia/e672-comparativo-aditivo.test.ts` (escrito antes, visto vermelho).

**Dúvida:** a "diferença" é de aluguel (soma dos blocos); a taxa de serviço do aditivo segue na linha própria. O dono do
imóvel não escolhe a saída: ela deriva dos meses de contrato, como no desenho atual (não criei campo de saída editável).

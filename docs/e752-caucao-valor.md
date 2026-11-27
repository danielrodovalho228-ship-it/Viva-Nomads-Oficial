# E752 — Caução com valor no anúncio e texto público alinhado

Achado (Phoenix, RELATORIO-004, C1): nos exemplos a Caução vinha sem quantia ("O valor fica no contrato") e o /como-funciona prometia "Caução de até 3 vezes o valor mensal, depositada em poupança", fora do desenho aprovado (50% do bloco, teto de 3 aluguéis, direto ao proprietário, a Viva não segura).

## O que mudou (sem migração)
- Cartão do anúncio e passo de solicitação: a linha "Caução do 1º bloco (N mês/meses)" mostra o VALOR pela regra do contrato (`caucaoDoBloco`: 50% do bloco, teto de 3 vezes o valor mensal), com o bloco da estadia mínima do anúncio (1 a 3 meses; sem ela, o padrão de 2 meses), e a regra: "paga direto ao proprietário e devolvida no fim, após a conferência de saída. A Viva não recebe nem segura esse dinheiro." (`caucaoDoPrimeiroBloco`, `NOTA_CAUCAO` em `src/lib/reserva-imovel.ts`).
- Texto público (`CAUCAO_FRASE`, que alimenta /como-funciona, /precos, propostas, Ajuda e o chat da Viva): "Caução de até 3 vezes o valor mensal, paga direto ao proprietário — a Viva não recebe nem segura esse dinheiro." Saiu a promessa de poupança. /como-funciona: "Paga antes da entrada" no lugar de "Depositada".

## Decisão registrada
A guarda pública (`tests/atendimento/regras-publicas.test.ts`, ordem f581c899) proíbe regra de bloco e percentual na Ajuda e no chat. Por isso "50% do bloco" aparece só no cartão do anúncio, onde a pessoa vê o valor; o texto público fala em teto de 3 vezes o valor mensal. Se o coordenador quiser o 50% também na Ajuda/chat, é trocar a guarda e a frase.

Testes: `src/lib/e752-caucao-valor.test.ts` e os ajustados (reserva-imovel, vocabulario-publico, atendimento).

# E685 + E686 — documento do parceiro ativo no admin e "Como é pago" dos avaliadores (auditoria E683)

## E685 (P1) — documento visível na aba Ativas de `/admin/parceiros`
- **Problema:** Pendentes e Recusadas mostravam o documento; Ativas não. A regra "parceiro só com CNPJ" não era auditável pela interface para quem já está ativo.
- **Correção:** cada linha de parceiro ativo traz o tipo e o número **mascarado**: `CNPJ: 12.345.678/****-**` ou `CPF: ***.456.789-**`; sem documento, "não informado" (`data-testid="linha-ativa-documento"`).
- **De onde vem:** do pedido já ativado (`parceiro_solicitacoes`), numa leitura só da aba Ativas (`docsAtivos`). Falha na leitura lança erro; não vira "sem documento". Helper `documentoDoParceiroAtivo` em `src/lib/documento-pessoa.ts`.
- **Por que mascarado:** não ampliar a exposição do número. Se a equipe precisar do número inteiro, é trocar a máscara por `formatarDocumento` (uma linha).

## E686 (P2) — `/parceiros/avaliadores`, "Como é pago"
- **Problema:** o bloco dizia que o valor "segue a tabela da Viva" ao lado de "você define o seu valor": contradição que fere o desenho anti-subordinação.
- **Correção:** "Você define o seu valor e o seu prazo em cada pedido; a tabela da Viva para a cidade e o porte do imóvel é só uma referência." Ficam "Você paga a avaliação, não o resultado" e "Quem paga é o dono do imóvel".

## Testes
`src/lib/parceiros/e685-documento-ativo.test.ts` e `src/lib/parceiros/e686-avaliadores-como-e-pago.test.ts` (vermelho antes, verde depois). Escopados: 199 verdes; `tsc` limpo. Sem migração.

## Limite
Não vi a tela do admin ao vivo (exige papel de admin); a prova ao vivo é do QA do chat principal.

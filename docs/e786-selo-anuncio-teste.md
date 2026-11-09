# E786 — selo do anúncio de teste estoura na horizontal
Causa: `Button` tem `whitespace-nowrap` e altura fixa; o texto "Anúncio de teste da equipe Viva — não é um imóvel disponível" não cabia.
Correção: no cartão (computador) e na barra fixa (celular), só no modo teste-visitante, `whitespace-normal`, altura automática, centralizado. Botão normal inalterado.
Teste: `src/components/property/e786-selo-teste-sem-transbordo.test.ts`. Sem prova ao vivo (QA).

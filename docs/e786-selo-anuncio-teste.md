# E786 — selo do anúncio de teste estoura na horizontal
Causa: `Button` tem `whitespace-nowrap` e altura fixa; o texto "Anúncio de teste da equipe Viva — não é um imóvel disponível" não cabia.
Correção: no cartão (computador) e na barra fixa (celular), só no modo teste-visitante, `whitespace-normal`, altura automática, centralizado. Botão normal inalterado.
Teste: `src/components/property/e786-selo-teste-sem-transbordo.test.ts`. Sem prova ao vivo (QA).

## Varredura (relato a 1920 px, cortado nas duas pontas)
O botão do cartão ficava `whitespace-nowrap` e centralizado, então o texto vazava dos dois lados; o ajuste do cartão vale para qualquer largura. Superfícies da faixa: anúncio (`faixa-anuncio-teste`, `<p>`, quebra natural), barra fixa (corrigida), perfil de parceiro de teste (`faixa-parceiro-teste` e aviso, `<p>`). Nenhuma outra usa a faixa como rótulo de botão. Guarda no teste.

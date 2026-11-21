# Achado 159 — Estrutura de acessibilidade: leitura que falha virava checklist vazio EDITÁVEL

Fluxo: dono › cadastro/edição do imóvel › "O imóvel tem estrutura de acessibilidade?". A falha ao ler o checklist salvo virava `{}` e a tela
seguia editável: marcar um item gravava SÓ esse item e apagava o salvo. Se a chamada ao servidor falhasse de vez, a seção sumia.
Agora a falha mostra "Não foi possível carregar a estrutura de acessibilidade agora. O que você já marcou continua salvo." com "Tentar de
novo" e não libera a edição. Teste: `src/lib/data/achado159-estrutura-leitura.test.ts` (visto vermelho antes). Escopo estrutura: 21/21; `tsc` limpo.

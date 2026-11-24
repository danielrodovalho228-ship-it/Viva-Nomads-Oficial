# E688 — saída AquiResolve (parceiro geral) fora das superfícies (Pista A)

**Decisão do Daniel (08/11/2026):** retirar a promessa da saída AquiResolve das superfícies por ora. Não se promete o que não está cadastrado (o registro da Maira foi adiado em 18/10). Reversível se/quando ela se cadastrar.

**Onde aparecia:** o cartão "Parceiro geral da Viva" quando a busca de parceiros não acha ninguém: `BuscaVazia` (`/parceiros/buscar`, `/buscar`) e `/parceiros/fotografos`, ambos via `mostrarParceiroGeral`. Só aparecia com a chave `PARCEIRO_GERAL_FALLBACK` ligada e um nome salvo pelo admin. A busca vazia continua com "Quero ser avisado" e "Indique um profissional".

**O que mudou:** `PARCEIRO_GERAL_NAS_SUPERFICIES = false` em `src/lib/parceiros/regras.ts`; `mostrarParceiroGeral` devolve falso enquanto ela estiver desligada, mesmo com a chave ligada no admin. A configuração do admin foi mantida (com aviso de que está pausada). Nenhuma migração, nenhum dado apagado.

**Para reverter:** trocar a constante para `true` (e ligar a chave no admin).

**Testes:** `regras.test.ts` (regra com a superfície ligada + trava de que está fora) e spec t236 (o cartão e o nome não aparecem). Nenhum texto de ajuda, FAQ ou página pública em `src` citava o AquiResolve.

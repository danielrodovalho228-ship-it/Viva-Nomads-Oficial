# E827 — Faixa de confiança da home promete mais do que a plataforma faz

## Problema
A faixa da home dizia "Perfil verificado" e "Documentação do imóvel conferida" como se valesse para todo anúncio.
Rafael T. (ube-004) tem só e-mail + telefone; publicar **não** exige identidade verificada
(`perfilDonoCompleto` pede nome e telefone válidos).

## O que é verdade para todo anúncio (lastro no código)
- **Cartão do proprietário** (`src/components/property/owner-card.tsx`, `data-testid="proprietario-selos"`) mostra só os selos
  reais: "E-mail confirmado", "Telefone verificado" (`selosReais`, `src/lib/perfil/perfil-publico.ts`) e "Dono verificado"
  só com `profiles.is_verified` (`donoVerificado`). O anúncio já exibe o estado real; a faixa passa a apontar para isso.
- **Documento do imóvel**: `src/lib/data/actions.ts` recusa publicar sem `qualificacao.status === "approved"`.

## Correção
Fonte única em `src/config/textos-regulados.ts`:
- `SELO_VERIFICACOES_ANUNCIANTE = "Verificações do anunciante à vista em cada anúncio"` (no lugar de "Perfil verificado").
- `SELO_DOCUMENTO_IMOVEL = "Documento do imóvel conferido antes de publicar"` (dito como regra de publicação).
`SELO_PERFIL_VERIFICADO` continua exportado (o teste E785 o confere), mas sai da faixa.

## Teste
`node --test src/lib/e827-faixa-confianca.test.ts` — main: pass 0 / fail 1 (exports inexistentes); branch: pass 3 / fail 0.
Escopados (e827 + frases-proibidas + home-imagens + perfil): pass 128 / fail 0. tsc limpo; check:consistency OK.

## Asserções alteradas
- `src/lib/home-imagens.test.ts` H3: troca `SELO_PERFIL_VERIFICADO` e "Documentação do imóvel conferida" pelas duas constantes novas.
- `src/lib/frases-proibidas.test.ts` E785: a home importa `SELO_VERIFICACOES_ANUNCIANTE` (antes `SELO_PERFIL_VERIFICADO`).
- `tests/e2e/specs/t217-home-busca-3s.spec.ts`: textos novos da faixa.

## Dúvidas
- Conflito esperado com #3781 (E813), que também mexe na H3 de `home-imagens.test.ts` e na t217 ("Caução documentada"). Quem mesclar depois resolve juntando as duas trocas.
- Alternativa não feita: mostrar o selo "Dono verificado" na faixa só quando todos os anunciantes forem verificados (hoje não são).

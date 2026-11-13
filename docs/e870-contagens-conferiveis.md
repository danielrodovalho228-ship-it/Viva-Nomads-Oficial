# E870: contagens e tempos que a visitante consegue conferir

Foto da main: `27dbdf1`. Origem: Phoenix RELATORIO-020, A-95 e A-96 (12/11/2026).

## Defeitos

1. **Contagens facetadas sem aviso.** As contagens do "Mais filtros" recalculam dentro da seleção corrente (`facetaInterruptor` / `facetaUnica`). Com "Aceita pets" marcado, "Para trabalhar de casa" cai de 10 para 4, e nada diz que a base mudou.
2. **"Até 10 min de carro" sem rota.** Em produção não há provedor de rota (`useTempos` → linha reta). Nesse modo, o limite "até N min" só tira quem nem na velocidade máxima do modo chegaria a tempo (`foraDoTempoPelaReta`, E523): a 80 km/h, 10 min equivalem a 13,3 km em linha reta. Assim, nenhum dos 15 sai. A única explicação ("Tempo de deslocamento indisponível…") fica escondida na pílula "Local", e o cartão mostra só a distância.

## Correção

- **`src/lib/busca/contagens-conferiveis.ts`:**
  - `TEXTO_CONTAGEM_FACETADA`: com algo marcado, o painel diz "Os números já contam com os filtros marcados: mudam quando você marca ou desmarca outro." (`painel-contagem-facetada`).
  - `textoLimiteSemRota(modo, ate)`: com destino, "até N min" e linha reta, a lista mostra um aviso (`busca-limite-sem-rota`). Ele diz, em km, o que o limite faz e que os cartões mostram a distância em linha reta, não o tempo. É a mesma conta do filtro (`VELOCIDADE_MAX_KMH`).
- **Tempo estimado por imóvel:** não foi inventado. Sem provedor de rota, não há tempo honesto para mostrar no cartão.

## Testes

- **Unitário:** `node --test src/lib/busca/e870-contagens-conferiveis.test.ts`.
  - main: falha, porque o módulo não existe.
  - branch: 3 pass.
- **Escopo** (busca, rotas, estilo, componentes da busca): **319 pass / 0 fail**. tsc limpo.
- **E2E:** `tests/e2e/specs/t1621-e870-contagens-facetadas.spec.ts`, com os 15 exemplos (`?exemplos=1`), a 1280 e a 390 px.

| Base | t1621 |
|---|---|
| main `27dbdf1` | **2 failed**: "aviso das contagens facetadas" não encontrado depois de marcar "Aceita pets" |
| branch | **2 passed** (5.8m) |

A parte do "até N min" (A-96) não tem E2E: depende de não haver provedor de rota, e o lab usa um provedor falso. Ela fica coberta pelo unitário, que confere o texto contra a mesma conta do filtro (13,2 km fica, 13,4 km sai, para 10 min de carro).

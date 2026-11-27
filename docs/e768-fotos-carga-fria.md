# E768 — fotos pendentes na carga fria (anúncio, /buscar, /empresas, catálogo)

## O que a reprova viu (11/11)
Na **primeira** abertura, várias fotos ficavam pendentes:
- ube-001: 3 de 5;
- ube-003: 4 de 5;
- /buscar: 11 fotos;
- herói de /empresas e tiles do catálogo.

No reload, tudo carregava. O padrão aparece em **todos** os tipos de página: é o otimizador de imagens, não um componente.

## Causa
Em produção, `next.config.ts` pedia `formats: ["image/avif", "image/webp"]`. Navegadores reais (Chrome, Safari) anunciam AVIF, então cada foto era **codificada em AVIF na primeira vez** em que alguém a pedia. O próprio Next documenta: "AVIF generally takes 50% longer to encode … the first time an image is requested, it will typically be slower". No reload a variante já está em cache, por isso tudo carrega.

Medição local (build de produção, cache do otimizador vazio, 8 fotos do acervo, `/_next/image` com `Accept` de cada formato):

| Formato | 1920 px (galeria/herói) | 640 px (cartões) | Peso médio 1920 / 640 |
|---|---|---|---|
| AVIF | média **2,74 s** (máx. 3,49 s) | 0,45 s | 75 KB / 13 KB |
| WebP | média **0,39 s** (máx. 0,44 s) | 0,09 s | 117 KB / 24 KB |

O AVIF custa cerca de **7×** mais para codificar. Numa página com 5 a 18 fotos, os pedidos fazem fila no otimizador (na Vercel, com CPU bem menor que a desta máquina), e as fotos ficam pendentes.

O laboratório já usava só WebP pelo mesmo motivo: o comentário antigo registrava que codificar AVIF "leva dezenas de segundos e estoura t119/t48".

## Correção
`formats: ["image/webp"]` em todo lugar. Custo: cerca de 42 KB a mais por foto grande (~0,1 s em 4G), contra cerca de 2,3 s a menos de codificação por foto na primeira carga.

## Fora desta correção (Dúvidas)
- **`minimumCacheTTL`** (padrão de 4 h no Next 16): depois de 4 h sem visita, a próxima abertura volta a gerar cada foto. Um TTL longo reduziria isso, mas o avatar reusa o mesmo caminho no Storage (`<id>/avatar.webp`), e a troca de foto de perfil ficaria presa no cache até o TTL vencer. Mantive o padrão; se quiserem, dá para versionar o caminho do avatar e então subir o TTL.
- **Ambiente:** não dá para reproduzir a CPU do otimizador da Vercel localmente. A prova local é o custo de codificação por formato, acima, mais a sonda de carga fria do PR.

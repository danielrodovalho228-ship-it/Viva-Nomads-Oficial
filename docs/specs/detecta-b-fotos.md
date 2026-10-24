# DETECTA-B — o que as fotos da galeria mostram (sugestão)

Pista B · migração 0239 · chave `DETECCAO_FOTOS_ATIVO` **desligada**.

## O que faz

No passo **Comodidades** (cadastro novo e edição pelo assistente) e na seção **Comodidades** da edição do anúncio, as
fotos da galeria (`property_photos`, só a pasta do dono) que ainda não foram analisadas vão, uma a uma, ao modelo, que
responde com uma **lista fechada**:

- os itens de Conforto/Premium provados por foto (`src/config/niveis.ts`, `prova: "foto"`, que estão em `MATRIZ`);
- as comodidades estruturadas que os filtros leem (`COMODIDADES_FILTRO`: internet fibra, cozinha equipada, vaga de
  garagem, máquina de lavar);
- cada um com a confiança (0–1) e se há **pessoa** na foto.

O servidor valida o JSON (`validarDeteccao`): chave fora da lista sai, confiança presa entre 0 e 1, abaixo de 0,6 sai.
Foto de perfil e de documento nunca entram (a fonte é só `property_photos`).

## Regras

| Regra | Onde |
| --- | --- |
| Chave desligada: nada é enviado, a tela fica como hoje | `deteccaoAtiva()` antes de qualquer leitura (`deteccao-actions.ts`) |
| Cache por hash: cada foto vai ao modelo uma vez só | `deteccao_fotos_analises` (anúncio + caminho e anúncio + hash SHA-256 dos bytes) |
| Sugestão nunca conta para o nível nem marca comodidade | `deteccao_sugestoes` com status `sugerida`; o nível só lê `nivel_itens` |
| Confirmar usa o caminho de hoje | item de nível → `salvarItemNivel(id, chave, true, foto)` (foto vai "em análise"); comodidade → a tela marca e o salvar do anúncio grava |
| "O que falta" | `faltaSemSugestao(nivelAgoraEFalta(...).falta, sugeridas)`: sem foto aceita **e** sem sugestão |
| Foto com pessoa | tudo dela fica `descartada` (motivo `pessoa`) e aparece "Foto com pessoa não serve de prova" |
| JSON inválido | a análise é gravada sem itens (não cobra de novo) e a tela segue |
| Limites | `consumirLimite`: 40 fotos/dia por anúncio e 120 fotos/dia por dono, contados antes de cada chamada |
| Admin | /admin → "Detecção nas fotos": chave ligada/desligada e fotos analisadas por dia (7 dias) |

## Custo estimado (para o Daniel decidir se liga)

Cada foto é reduzida a **1024 px** no lado maior (JPEG) antes de ir ao modelo.

- Imagem 1024 × 768: 1024 × 768 ÷ 750 = **1.049 tokens** (regra da documentação da Anthropic).
- Texto fixo (instruções + 22 itens da lista): ~**608 tokens**.
- Entrada por foto: **1.657 tokens**. Saída por foto: até ~**150 tokens** (pessoa + itens com confiança; esforço "low").
- Conta: `(1.657 × preço de entrada + 150 × preço de saída) ÷ 1.000.000`.

| Modelo | Preço (US$/milhão, entrada/saída) | Por foto | Anúncio com 20 fotos | Anúncio com 40 fotos |
| --- | --- | --- | --- | --- |
| claude-opus-5-5 (o configurado) | 4 / 20 | US$ 0,0096 | US$ 0,19 | US$ 0,39 |
| claude-sonnet-5-5 | 2 / 10 | US$ 0,0048 | US$ 0,10 | US$ 0,19 |
| claude-haiku-5-5 | 0,10 / 0,50 | US$ 0,00024 | US$ 0,005 | US$ 0,01 |

- Cada foto é paga **uma vez** (cache por hash); voltar ao passo ou editar o anúncio não cobra de novo. Foto nova paga só ela.
- Teto por dono por dia (120 fotos): US$ 1,16 no Opus 5.5, US$ 0,03 no Haiku 5.5.
- A estimativa está em `estimativaCusto()` (`src/lib/fotos/deteccao.ts`), coberta por teste; o modelo é a constante
  `MODELO_DETECCAO` no mesmo arquivo.

## Como ligar

Na Vercel, `DETECCAO_FOTOS_ATIVO=on` (só servidor). Usa a `ANTHROPIC_API_KEY` que já está em produção. No laboratório o
E2E liga só no próprio navegador pelo cookie `vn_lab_deteccao=1` (sem efeito em produção).

## Testes

- `src/lib/fotos/deteccao.test.ts`: desligada não chama nada; cache por hash; sugestão não conta antes de confirmar;
  confirmar usa o caminho de hoje; foto com pessoa descartada; JSON inválido não quebra; limites; custo; contador.
- `tests/e2e/specs/t389-deteccao-fotos.spec.ts` (laboratório, 390 e 1280 px): desligada; sugestões + aviso; cache;
  confirmar item de nível e comodidade.
- Migração: aplicar duas vezes, RLS (dono lê as do próprio anúncio, outro não, ninguém grava pelo cliente), rollback.

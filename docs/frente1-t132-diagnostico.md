# Frente 1 — t132-solicitar-reserva: diagnóstico (11/11/2026)

## Resultado: sem regressão de código. A causa foi spec desatualizado por decisão registrada; a asserção já está acertada na main.

- **Hoje o t132 não testa o pedido de reserva.** Desde o E694 (08/11, `e361d2e7e`), ele confere o **anúncio de exemplo** `/imoveis/ube-001`:
  - o cartão explica que o anúncio é de exemplo;
  - não há "Pedir para morar";
  - a saída leva a "Ver imóveis reais" (`/buscar`).
- **Erro gravado nas rodadas vermelhas** (`lab_execucoes` de 10/11 e 11/11, schedule e push no commit `954bbece6`/`0533d3541`):
  `toContainText("Anúncio de exemplo")` em `exemplo-sem-acoes`, recebendo "Este anúncio é de exemplo, para você ver como a Viva funciona…".
- **Commit que quebrou:** achado comparando, commit a commit, o texto do componente com a asserção do spec (`git show <commit>:<arquivo>`). Não rodei `git bisect` no laboratório: a falha é uma asserção de texto e a comparação é determinística.
  - `e361d2e7e` (E694) e `c4f83881b`: o cartão ainda tinha o parágrafo `EXEMPLO_AVISO_DEMO` ("Anúncio de exemplo: …"), e o spec passava.
  - **`d02f79e39`** (08/11 12:26 UTC, "E713 (resíduo): a coluna do exemplo também perde o aviso 'esta solicitação não é enviada'") removeu esse parágrafo. O texto "Anúncio de exemplo" saiu do cartão e o spec ficou vermelho.
- **A mudança do produto foi decidida.** O achado é o **D-E713-a** da QA do Muse de 08/11: "a coluna de reserva segue com 4 campos e o aviso 'não é enviada'" (`docs/qa-medicao-log.md` e `docs/qa-rodadas/2026-11-08-0310.md`). O E713 resíduo cumpriu essa decisão.
- **Acerto do spec:** `24902a83c` (E744, mesclado na main com o #3588 em 11/11 23:18 UTC) trocou a asserção por `/anúncio é de exemplo/i`.
  - Na última rodada completa (10/11 10:47 UTC, run 42792426869, branch do E744), o t132 deu 2 pass e 0 fail.
  - Os vermelhos de 10–11/11 eram rodadas da main **antes** desse merge.

## Asserção alterada (regra 4)

| Spec | Antes | Agora | Decisão | Ação |
|---|---|---|---|---|
| t132 | `exemplo-sem-acoes` contém "Anúncio de exemplo" | contém `/anúncio é de exemplo/i` | E713 resíduo, achado D-E713-a da QA do Muse, 08/11/2026 | manter (já na main, `24902a83c`) |

## O fluxo principal de reserva está verde

Na rodada completa de 10/11 10:47 UTC, todos verdes:
- t130-reserva-imovel: 5 pass;
- t133-candidatura-motivo: 2;
- t182-jornada-completa: 8;
- t225-candidatura-etapas: 2;
- t875-e581-candidatura-repetida: 2.

Ficou um vermelho no mesmo fluxo: o t678-e202-emails-candidatura, com 1 falha. Não está na lista dos 35 (não tinha verde antes) e vai para a Frente 6.

## Prova ao vivo (critério da Frente 1)

Com a conta de morador de teste:
1. abrir um anúncio de teste;
2. solicitar reserva de 30 a 180 dias;
3. ver a candidatura chegar ao dono de teste.

Sem erro e sem tela vazia.

## Conferência na main (12/11/2026)
Rodada do laboratório no push da main `02a337e62` (12/11 01:11 UTC, primeira com o acerto `24902a83c` na main): **t132 com 2 pass e 0 fail**. As rodadas anteriores da main ainda estavam vermelhas: `d32300e14` (12/11 00:10) e `0533d3541` (11/11 18:27), as duas com 2 falhas.

## Regra 2 (teste que falha na main e passa depois)
Não se aplica: não há defeito de código a corrigir, e a asserção já foi acertada na main por decisão registrada (E713, achado D-E713-a). Este PR só registra o diagnóstico, o commit que quebrou e a decisão citada. O teste que comprova é o próprio t132, verde na main desde `02a337e62`.

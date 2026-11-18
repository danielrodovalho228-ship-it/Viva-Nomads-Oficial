# E614 — a retoma do rascunho: o passo grava e o topo mostra "Salvo às"

Oráculo (Gerente, ORDEM-DUET-097):
- Regra do E507: "Continuar de onde parou" aterra no próximo item pendente da checklist.
- Regra nova (DUET-1719): o rascunho retomado mostra sempre "Salvo às HH:MM", também no Passo 3.
- Trava: t2140, do #3967.

## Defeitos e causas

**(i) O passo retomado não persistia.** Ao abrir um rascunho, o assistente espera 2 s até o estado carregado assentar (E516: abrir não é editar). Nesse intervalo, só uma edição ou uma confirmação de valor (E614) gravavam.

Um "Continuar" que só troca de passo, feito antes dos 2 s (o dono reabre e segue logo), virava base. Nada era gravado e, ao reabrir, o rascunho voltava ao passo antigo.

**(ii) Sem "Salvo às" ao reabrir.** O banco não guardava a hora da última gravação: `properties` não tem `updated_at` e o `draft_data` não tinha carimbo. Ao reabrir, o indicador ficava escondido até a próxima edição.

## Correção

Em `src/lib/anuncio/salvo-fantasma.ts` e `novo/page.tsx`:
- `decisaoAutosave` ganha `navegou`. Trocar de passo antes de o rascunho assentar grava em silêncio, como a confirmação. A navegação base, `[passo, mais longe]`, fica guardada no `aplicarDraft`.
- Toda gravação, de edição ou de navegação, carimba `salvoEm` (ISO) no `draft_data`. O carimbo fica fora do JSON comparado pelo autosave, então não gera laço de gravação.
- `salvoAsDoRascunho(d)`: ao aplicar o rascunho, o topo mostra "Salvo às HH:MM" da última gravação, sem edição e em qualquer passo.
- Rascunhos anteriores à regra (sem `salvoEm`) seguem como antes, sem indicador até a primeira gravação.

## Provas

- Unidade, `salvo-fantasma.test.ts`: 3 testes novos `E614 retomar…`, vermelhos sem a correção (fail 3) e verdes com ela (pass 8, fail 0).
- E2E t2140 (trava do #3967) no laboratório com a correção (ef7f1461d):
  - 4 passed;
  - `--repeat-each=3`: 12 passed.
- Vizinhos do indicador (E516/E208), no mesmo build:
  - t309 (abrir não carimba; a edição carimba), t571 e t646: 8 passed.
- E2E t2140 na main d8f4ceb (sem a correção): **4 failed** — todos em `estado-salvamento` ausente ao reabrir ("o rascunho retomado mostra o indicador de salvamento, sem edição").

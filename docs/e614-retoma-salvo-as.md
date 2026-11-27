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

## 18/11, noite — a correção não mordia em produção (ORDEM-DUET-137)

Terceira reprodução ao vivo (ronda das 18:00): com a correção e a t2140 na main e o deploy no ar, o rascunho reabriu no Passo 2 sem "Salvo às".

**Por que a t2140 passava e a produção não mostrava.** A t2140 só confere o indicador depois de ela própria provocar uma gravação com o código novo, num rascunho completo. Em produção nenhuma dessas duas coisas acontecia:

- Os 39 rascunhos de produção não tinham `salvoEm` (leitura de 19/11, 00:35Z: 39 rascunhos, 0 com carimbo). Sem carimbo, `salvoAsDoRascunho` devolve nulo e o indicador fica escondido. Era a limitação escrita acima ("rascunhos anteriores à regra seguem como antes").
- Entre o deploy (18/11, 22:57Z) e as 00:45Z, o registo do banco de produção mostra uma única criação de rascunho (00:18:42Z) e nenhuma gravação do autosave até ele ser apagado, dois minutos depois.

**Causas, todas reproduzidas no laboratório na main `2b591232`:**

1. Rascunho sem carimbo reabre sem indicador.
2. O rascunho criado ao sair da Qualificação ("Começar o cadastro") nascia sem carimbo: só o autosave carimbava.
3. Num rascunho ainda sem conteúdo (só o tipo), o autosave desistia antes de gravar. O "Continuar" até o Passo 2 não chegava ao servidor; reaberto, o rascunho voltava ao Passo 1.
4. A cópia do navegador, a outra fonte da retoma, nunca levava carimbo.

**Correção (recurso decidido pelo Gerente, ORDEM-DUET-139/140):**

- A hora do indicador é o `salvoEm`; na falta dele, `properties.updated_at` (migração 0346, por gatilho); numa linha ainda não regravada depois da 0346, a hora da criação. Abrir continua a não gravar nada.
- `saveDraftData` carimba toda gravação que chega sem carimbo, venha de onde vier.
- O autosave grava o rascunho sem conteúdo quando ele já existe no servidor.
- A cópia do navegador leva a hora em que foi guardada; com o mesmo conteúdo, fica como estava.

**Trava:** t1693 (três caminhos, 390 e 1280 px), vermelha na main e verde com a correção. Unidade: `src/lib/anuncio/e614-retoma-sem-carimbo.test.ts`.

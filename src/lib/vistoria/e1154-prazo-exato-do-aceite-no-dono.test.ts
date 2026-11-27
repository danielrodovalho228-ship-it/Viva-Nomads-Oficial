import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ERRO_ACEITE_FORA_DO_PRAZO, relogioDoPedido, textoDoPrazoDeAceite, textoDoPrazoDeAceiteParaODono } from "./relogio-do-pedido.ts";
import { dataHoraBRT } from "../datas-brasilia.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1154 (ORDEM-DUET-651; D3 da varredura do lado do dono, ORDEM-DUET-656). Para o MESMO prazo de aceite, o avaliador lia
  a hora de fim ("O proprietário tem até 27/11/2026 03:46 (horário de Brasília)…") e o dono, que é quem tem de agir, lia
  só "Aceite em até 72 horas depois da proposta" — e fazia a conta. O bloco da proposta do dono passa a mostrar o mesmo
  instante, no mesmo formato, saído do mesmo relógio (relogio-do-pedido).
  Roda: node --test src/lib/vistoria/e1154-prazo-exato-do-aceite-no-dono.test.ts
*/
const ler = (p: string) => readFileSync(p, "utf8");
const PROPOSTA = "2026-11-24T06:46:00.000Z"; // 03:46 em Brasília
const estado = { status: "designado", resposta: "aceita", designadoEm: "2026-11-24T05:00:00.000Z", propostaEm: PROPOSTA, propostaAceitaEm: null, precisaDoAceite: true };

test("E1154: o dono lê a mesma hora de fim que o avaliador, no mesmo formato, do mesmo relógio", () => {
  const r = relogioDoPedido(estado, new Date("2026-11-24T16:46:00.000Z"))!;
  assert.equal(r.vez, "dono");
  assert.equal(r.vencido, false);
  const fim = dataHoraBRT(r.ate);
  assert.equal(fim, "27/11/2026 03:46 (horário de Brasília)");
  // A frase de antes continua inteira; entra só a hora de fim.
  assert.equal(textoDoPrazoDeAceiteParaODono(r), "Aceite em até 72 horas depois da proposta, até 27/11/2026 03:46 (horário de Brasília); passado o prazo, você escolhe outro avaliador.");
  // O avaliador lê o mesmo instante, escrito igual.
  assert.ok(textoDoPrazoDeAceite(r).includes(`até ${fim}`));
  assert.ok(textoDoPrazoDeAceiteParaODono(r).includes(`até ${fim}`));
});

test("E1154: sem prazo a correr a frase fica como era, sem data; já vencido, diz que o prazo terminou (E1147)", () => {
  const SEM_DATA = "Aceite em até 72 horas depois da proposta; passado o prazo, você escolhe outro avaliador.";
  assert.equal(textoDoPrazoDeAceiteParaODono(null), SEM_DATA);
  // Vencido: não se promete o aceite "até" uma hora que já passou. E1147 (ORDEM-DUET-678): nessa janela a frase deixa
  // de convidar a aceitar e diz que o prazo terminou — antes ficava a frase de sempre, só sem a data.
  const vencido = relogioDoPedido(estado, new Date("2026-11-27T07:46:00.000Z"))!;
  assert.equal(vencido.vencido, true);
  assert.equal(textoDoPrazoDeAceiteParaODono(vencido), ERRO_ACEITE_FORA_DO_PRAZO);
  assert.doesNotMatch(textoDoPrazoDeAceiteParaODono(vencido), /até \d\d\/\d\d\/\d{4}/, "nenhuma hora de fim que já passou");
  // O relógio do avaliador (antes da proposta) não é o prazo do dono.
  const doAvaliador = relogioDoPedido({ ...estado, resposta: null, propostaEm: null }, new Date("2026-11-24T06:00:00.000Z"))!;
  assert.equal(doAvaliador.vez, "avaliador");
  assert.equal(textoDoPrazoDeAceiteParaODono(doAvaliador), SEM_DATA);
});

test("E1154: o bloco do dono escreve o prazo pela função do relógio — nenhuma frase do prazo escrita à mão", () => {
  const bloco = semComentarios(ler("src/components/vistoria/bloco-avaliacao-dono.tsx"));
  assert.doesNotMatch(bloco, /Aceite em até/, "a frase sai de relogio-do-pedido");
  assert.match(bloco, /<p [^>]*data-testid="avaliacao-proposta-prazo"[^>]*>\s*\{textoDoPrazoDeAceiteParaODono\(relogioDoAceite\)\}\s*<\/p>/);
  // O relógio do bloco é o mesmo das outras telas, com a hora do pedido da página.
  assert.match(bloco, /const relogioDoAceite = atual\s*\?\s*relogioDoPedido\(\s*\{ status: atual\.status, resposta: undefined, designadoEm: null, propostaEm: atual\.proposta_em, propostaAceitaEm: atual\.proposta_aceita_em, precisaDoAceite: precisaDoAceiteDoDono\(\{ teste: atual\.teste, escolhidoEm: atual\.escolhido_em \}\) \},\s*agora,?\s*\)\s*:\s*null;/);
  const relogio = semComentarios(ler("src/lib/vistoria/relogio-do-pedido.ts"));
  assert.equal((relogio.match(/Aceite em até/g) ?? []).length, 1, "a frase do dono está escrita num lugar só");
});

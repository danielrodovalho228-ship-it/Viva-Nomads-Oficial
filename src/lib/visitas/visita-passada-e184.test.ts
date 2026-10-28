/*
  E184 — visita passada não fica "Confirmada" e a presencial confirmada nunca mostra "aparece quando for confirmada".
  Roda: node --test src/lib/visitas/visita-passada-e184.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FOLGA_ENDERECO_MS, regiaoDaVisita, statusDaVisitaNaTela, textoEnderecoPendente } from "./endereco-visita.ts";

const ler = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");
const horario = "2026-10-22T13:00:00Z";
const t = Date.parse(horario);

test("confirmada cujo horário já passou (com a folga) aparece como Feita", () => {
  assert.equal(statusDaVisitaNaTela({ status: "confirmado", horarioConfirmado: horario }, new Date(t + FOLGA_ENDERECO_MS + 60_000)), "feito");
  assert.equal(statusDaVisitaNaTela({ status: "confirmado", horarioConfirmado: horario }, new Date("2026-10-28T12:00:00Z")), "feito");
});

test("confirmada antes do horário (ou dentro da folga) segue Confirmada; outros estados não mudam", () => {
  assert.equal(statusDaVisitaNaTela({ status: "confirmado", horarioConfirmado: horario }, new Date(t - 3600_000)), "confirmado");
  assert.equal(statusDaVisitaNaTela({ status: "confirmado", horarioConfirmado: horario }, new Date(t + FOLGA_ENDERECO_MS)), "confirmado");
  assert.equal(statusDaVisitaNaTela({ status: "confirmado", horarioConfirmado: null }, new Date()), "confirmado");
  assert.equal(statusDaVisitaNaTela({ status: "pedido", horarioConfirmado: null }, new Date()), "pedido");
  assert.equal(statusDaVisitaNaTela({ status: "cancelado", horarioConfirmado: horario }, new Date("2026-12-01T00:00:00Z")), "cancelado");
});

test("presencial confirmada sem endereço exato: região e pedido pela conversa, nunca 'quando for confirmada'", () => {
  assert.equal(regiaoDaVisita({ address: "Saraiva", city: "Uberlândia" }), "Saraiva · Uberlândia");
  assert.equal(regiaoDaVisita({ address: " ", city: "" }), null);
  assert.equal(textoEnderecoPendente("Saraiva · Uberlândia"), "Região: Saraiva · Uberlândia. O proprietário ainda não cadastrou o número. Peça o endereço pela conversa.");
  assert.doesNotMatch(textoEnderecoPendente(null), /quando a visita for confirmada/);
  const cartao = ler("src/components/visitas/cartao-visita.tsx");
  // Confirmada sem endereço cai no aviso pendente, antes do texto "aparece quando for confirmada".
  assert.ok(cartao.indexOf('v.status === "confirmado" ? (') < cartao.indexOf("quando a visita for confirmada"));
  assert.match(cartao, /data-testid="visita-endereco-pendente"/);
});

test("o estado por data vale para as três leituras (painel do dono, do morador e topo da conversa)", () => {
  const acoes = ler("src/lib/data/visitas-video-actions.ts");
  // As três passam por mapear(), que aplica statusDaVisitaNaTela.
  assert.match(acoes, /status: statusDaVisitaNaTela\(/);
  assert.equal((acoes.match(/mapear\(r, /g) ?? []).length, 3);
});

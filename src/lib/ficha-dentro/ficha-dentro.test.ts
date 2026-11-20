/*
  E660 — Ficha "o que tem dentro". Obrigatório: camas por quarto (tipo; "solteiros que juntam" quando há 2+ solteiros),
  enxoval sim/não, cozinha equipada sim/não, ar-condicionado por quarto. Inventário numérico de pratos/talheres: OPCIONAL
  (decisão da coordenação: obrigatório viraria base de reclamação). A ficha congela na versão do contrato.
  Roda: node --test src/lib/ficha-dentro/ficha-dentro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import type { FichaDentro } from "./ficha-dentro.ts";
import { fichaVazia, normalizarFicha, faltasDaFicha, fichaCompleta, congelarFicha, linhasDaFicha, TIPOS_CAMA } from "./ficha-dentro.ts";

const completa = (): FichaDentro => ({
  versao: 1,
  quartos: [
    { nome: "Quarto 1", camas: [{ tipo: "casal", qtd: 1 }], solteirosJuntam: null, arCondicionado: true },
    { nome: "Quarto 2", camas: [{ tipo: "solteiro", qtd: 2 }], solteirosJuntam: true, arCondicionado: false },
  ],
  enxoval: true,
  cozinhaEquipada: true,
  utensilios: null,
});

test("fichaVazia cria um quarto por cômodo, tudo sem resposta (nunca 'não' por padrão)", () => {
  const f = fichaVazia(2);
  assert.equal(f.quartos.length, 2);
  assert.equal(f.enxoval, null);
  assert.equal(f.cozinhaEquipada, null);
  assert.equal(f.quartos[0].arCondicionado, null);
  assert.deepEqual(f.quartos[0].camas, []);
  assert.equal(fichaVazia(0).quartos.length, 1, "studio tem ao menos um espaço de dormir");
});

test("ficha completa não tem faltas; utensílios opcionais nunca entram nas faltas", () => {
  assert.deepEqual(faltasDaFicha(completa()), []);
  assert.equal(fichaCompleta(completa()), true);
  const comUtensilios = { ...completa(), utensilios: { pratos: 6, talheres: null } };
  assert.equal(fichaCompleta(comUtensilios), true);
  assert.equal(fichaCompleta({ ...completa(), utensilios: null }), true);
});

test("faltas: cama por quarto, ar por quarto, enxoval, cozinha — cada uma nomeada", () => {
  const f = completa();
  f.quartos[0].camas = [];
  f.quartos[1].arCondicionado = null;
  f.enxoval = null;
  f.cozinhaEquipada = null;
  const faltas = faltasDaFicha(f).join(" | ");
  assert.match(faltas, /Quarto 1.*cama/i);
  assert.match(faltas, /Quarto 2.*ar-condicionado/i);
  assert.match(faltas, /roupa de cama e banho/i);
  assert.match(faltas, /cozinha equipada/i);
});

test("'solteiros que juntam' só é cobrado com 2+ solteiros no quarto", () => {
  const f = completa();
  f.quartos[1].solteirosJuntam = null;
  assert.match(faltasDaFicha(f).join(" "), /Quarto 2.*juntam/i);
  f.quartos[1].camas = [{ tipo: "solteiro", qtd: 1 }];
  assert.deepEqual(faltasDaFicha(f), [], "1 solteiro: nada a juntar");
  f.quartos[1].camas = [{ tipo: "solteiro", qtd: 1 }, { tipo: "solteiro", qtd: 1 }];
  assert.match(faltasDaFicha(f).join(" "), /juntam/i, "duas entradas de solteiro somam 2");
});

test("normalizarFicha limpa o jsonb vindo do banco/rascunho (tipo inválido, qtd absurda, lixo)", () => {
  assert.equal(normalizarFicha(null), null);
  assert.equal(normalizarFicha("x"), null);
  const n = normalizarFicha({
    quartos: [{ nome: "  Suíte  ", camas: [{ tipo: "foguete", qtd: 3 }, { tipo: "casal", qtd: 99 }, { tipo: "king", qtd: 1.4 }], solteirosJuntam: "sim", arCondicionado: true }],
    enxoval: "true",
    cozinhaEquipada: false,
    utensilios: { pratos: -3, talheres: 12.7 },
  })!;
  assert.equal(n.versao, 1);
  assert.equal(n.quartos[0].nome, "Suíte");
  assert.deepEqual(n.quartos[0].camas, [{ tipo: "casal", qtd: 10 }, { tipo: "king", qtd: 1 }], "tipo fora da lista cai; qtd limitada a 1–10 e inteira");
  assert.equal(n.quartos[0].solteirosJuntam, null);
  assert.equal(n.enxoval, null, "só boolean de verdade vale");
  assert.equal(n.cozinhaEquipada, false);
  assert.deepEqual(n.utensilios, { pratos: null, talheres: 13 });
  assert.ok(TIPOS_CAMA.some((t) => t.valor === "sofa_cama"));
});

test("congelarFicha: cópia profunda com data; mudar o anúncio depois não muda a ficha do contrato", () => {
  const viva = completa();
  const c = congelarFicha(normalizarFicha(viva)!, new Date("2026-11-07T12:00:00Z"));
  viva.quartos[0].camas[0].qtd = 5;
  assert.equal(c.ficha.quartos[0].camas[0].qtd, 1);
  assert.equal(c.congeladaEm, "2026-11-07T12:00:00.000Z");
});

test("linhasDaFicha: texto para contrato/entrada, sem inventário quando não informado", () => {
  const l = linhasDaFicha(normalizarFicha(completa())!);
  assert.ok(l.some((x) => /Quarto 1: 1 cama de casal.*ar-condicionado/i.test(x)));
  assert.ok(l.some((x) => /Quarto 2: 2 camas de solteiro \(juntam\)/i.test(x)));
  assert.ok(l.some((x) => /Roupa de cama e banho: inclusa/i.test(x)));
  assert.ok(l.some((x) => /Cozinha equipada: sim/i.test(x)));
  assert.ok(!l.some((x) => /pratos|talheres/i.test(x)));
  const comU = linhasDaFicha(normalizarFicha({ ...completa(), utensilios: { pratos: 6, talheres: null } })!);
  assert.ok(comU.some((x) => /6 pratos/i.test(x)));
});

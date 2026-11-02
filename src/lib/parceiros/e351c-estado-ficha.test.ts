/* Roda: node --test src/lib/parceiros/e351c-estado-ficha.test.ts — E351 (c), resíduo: o estado de cada pedido de parceria
   à vista na fila de pendentes do admin (incompleto / não aprovável / pronto), com as mesmas regras do botão Aprovar. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoDaFicha } from "./fila-pendentes.ts";
import { checklistCompleto } from "./regras.ts";

const base = { status: "pendente", email: "a@b.co", categorias: ["fotografia"], cidades: ["Uberlândia"], documento: "12345678909" };
const tudo = { identidade: true, documento: true, area: true, categoria: true, documento_conferido_em: "2026-11-01T10:00:00Z" };

test("os quatro estados", () => {
  assert.deepEqual(estadoDaFicha({ ...base, status: "aguardando_email", checklist: {} }), { tipo: "aguardando", rotulo: "Aguardando a pessoa confirmar" });
  assert.deepEqual(estadoDaFicha({ ...base, cidades: [], documento: null, checklist: tudo }), { tipo: "incompleto", rotulo: "Cadastro incompleto · sem cidade, CPF/CNPJ" });
  assert.deepEqual(estadoDaFicha({ ...base, checklist: { identidade: true } }), { tipo: "checklist", rotulo: "Não aprovável ainda · faltam 4 de 5 itens do checklist" });
  assert.deepEqual(estadoDaFicha({ ...base, checklist: tudo }), { tipo: "pronto", rotulo: "Pronto para aprovar" });
});

test("'pronto' é exatamente quando o botão Aprovar libera", () => {
  for (const c of [{}, { identidade: true }, { ...tudo, documento_conferido_em: null }, tudo]) {
    assert.equal(estadoDaFicha({ ...base, checklist: c }).tipo === "pronto", checklistCompleto(c));
  }
});

test("a ficha mostra o selo no topo e a borda do estado", () => {
  const f = readFileSync(new URL("../../app/(dashboard)/admin/parceiros/fichas.tsx", import.meta.url), "utf8");
  assert.match(f, /data-testid="ficha-estado" data-estado=\{estado\.tipo\}/);
  assert.match(f, /className=\{cn\("border-l-4", BORDA_ESTADO\[estado\.tipo\]\)\}/);
  assert.match(f, /checklist: check \}\);/);
});

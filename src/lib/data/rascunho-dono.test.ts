/*
  Rascunho só é atualizado (e a qualificação só é ligada) se o imóvel é do dono.
  node --test (sem alias @).
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { atualizarRascunhoDoDono } from "./rascunho-dono.ts";

type Linha = { id: string; owner_id: string; status: string };

function falso(linhas: Linha[]) {
  return {
    from() {
      const filtros: Array<(l: Linha) => boolean> = [];
      const q = {
        update: () => q,
        eq: (c: keyof Linha, v: string) => (filtros.push((l) => l[c] === v), q),
        select: async () => ({ data: linhas.filter((l) => filtros.every((f) => f(l))).map((l) => ({ id: l.id })), error: null }),
      };
      return q;
    },
  };
}

const base: Linha[] = [{ id: "p1", owner_id: "dono", status: "draft" }];

test("rascunho do próprio dono: atualiza", async () => {
  const r = await atualizarRascunhoDoDono(falso(base), "p1", "dono", { title: "x" });
  assert.equal(r.atualizou, true);
});

test("rascunho de outro dono: 0 linhas, não atualizou (nada é ligado)", async () => {
  const r = await atualizarRascunhoDoDono(falso(base), "p1", "intruso", { title: "x" });
  assert.equal(r.atualizou, false);
  assert.equal(r.error, null);
});

test("imóvel já publicado não é rascunho: não atualizou", async () => {
  const r = await atualizarRascunhoDoDono(falso([{ id: "p1", owner_id: "dono", status: "active" }]), "p1", "dono", {});
  assert.equal(r.atualizou, false);
});

import { rascunhoVazioRecente } from "./rascunho-dono.ts";

type Prop = { id: string; owner_id: string; status: string; monthly_price: number; address: string; created_at: string };

function falsoProps(linhas: Prop[]) {
  return {
    from() {
      const filtros: Array<(l: Prop) => boolean> = [];
      const q = {
        select: () => q,
        eq: (c: keyof Prop, v: unknown) => (filtros.push((l) => l[c] === v), q),
        gte: (c: keyof Prop, v: string) => (filtros.push((l) => String(l[c]) >= v), q),
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: linhas.find((l) => filtros.every((f) => f(l))) ?? null, error: null }),
      };
      return q;
    },
  };
}

const agora = new Date("2026-10-21T12:00:00Z");
const vazio = (o: Partial<Prop>): Prop => ({ id: "r1", owner_id: "dono", status: "draft", monthly_price: 0, address: "", created_at: "2026-10-21T10:00:00Z", ...o });

test("rascunho vazio de 2 h do dono: reaproveita (não cria o 2º)", async () => {
  assert.equal(await rascunhoVazioRecente(falsoProps([vazio({})]), "dono", agora), "r1");
});

test("rascunho vazio de 80 h: não reaproveita", async () => {
  assert.equal(await rascunhoVazioRecente(falsoProps([vazio({ created_at: "2026-10-18T02:00:00Z" })]), "dono", agora), null);
});

test("rascunho com preço, com endereço ou de outro dono: não reaproveita", async () => {
  assert.equal(await rascunhoVazioRecente(falsoProps([vazio({ monthly_price: 2500 })]), "dono", agora), null);
  assert.equal(await rascunhoVazioRecente(falsoProps([vazio({ address: "Saraiva" })]), "dono", agora), null);
  assert.equal(await rascunhoVazioRecente(falsoProps([vazio({ owner_id: "outro" })]), "dono", agora), null);
});

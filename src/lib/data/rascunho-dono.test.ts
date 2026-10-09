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

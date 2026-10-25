/* PROP-3 (E116/E117). Roda: node --experimental-strip-types --test src/lib/bloco-status.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOCO_STATUS, rotuloDoBloco } from "./bloco-status.ts";

test("nenhum status cru na tela: pendente_aceite e qualquer código novo viram texto humano", () => {
  assert.equal(rotuloDoBloco("pendente_aceite").label, "Aguardando aceite");
  for (const s of ["pendente_aceite", "aguardando_x_y", "encerrado_em_acerto", ...Object.keys(BLOCO_STATUS)]) {
    assert.doesNotMatch(rotuloDoBloco(s).label, /_/, s);
  }
});

test("contrato Encerrado nunca tem bloco 'Em vigência' (proprietario1: contrato encerrado com bloco ainda 'ativo')", () => {
  assert.equal(rotuloDoBloco("ativo", null, false).label, "Encerrado");
  assert.equal(rotuloDoBloco("pendente_aceite", null, false).label, "Encerrado");
  assert.equal(rotuloDoBloco("renovado", null, false).label, "Renovado");
  assert.equal(rotuloDoBloco("ativo", "em_vigencia", true).label, "Em vigência");
  assert.notEqual(rotuloDoBloco("ativo", "aguardando_pagamento", true).label, "Em vigência");
});

test("guarda: nas telas do dono, nenhum status é exibido cru (MAPA[s] ?? s) — o fallback é sempre statusHumano", async () => {
  const { readFileSync } = await import("node:fs");
  const arquivos = [
    "../app/(dashboard)/dashboard/pedidos/pedidos-client.tsx",
    "../app/(dashboard)/dashboard/pedidos-cidade/pedidos-dono-client.tsx",
    "../components/conforto/pendencias-conforto.tsx",
    "../components/documentos/documentos-contrato.tsx",
    "../app/(dashboard)/dashboard/contratos/contratos-client.tsx",
  ];
  for (const a of arquivos) {
    const src = readFileSync(new URL(a, import.meta.url), "utf8");
    assert.doesNotMatch(src, /\[([\w.]+)\.status\]\s*\?\?\s*\1\.status\b/, `${a}: status cru no fallback`);
    assert.doesNotMatch(src, /\?\?\s*\{\s*label:\s*status\b/, `${a}: rótulo = código`);
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { montarDecisaoDocumento } from "./decisao-documento.ts";

const agora = new Date("2026-10-09T18:00:00Z");

test("aprovar grava revisor e data, sem motivo", () => {
  const d = montarDecisaoDocumento(true, "ignorado", "admin-1", agora);
  assert.equal(d.document_status, "approved");
  assert.equal(d.document_review_reason, null);
  assert.equal(d.document_reviewed_by, "admin-1");
  assert.equal(d.document_reviewed_at, "2026-10-09T18:00:00.000Z");
});

test("recusar grava motivo e revisor", () => {
  const d = montarDecisaoDocumento(false, "Ilegível", "admin-1", agora);
  assert.equal(d.document_status, "rejected");
  assert.equal(d.document_review_reason, "Ilegível");
  assert.equal(d.document_reviewed_by, "admin-1");
});

test("sem revisor não decide (caso negativo)", () => {
  assert.throws(() => montarDecisaoDocumento(true, "", "", agora));
});

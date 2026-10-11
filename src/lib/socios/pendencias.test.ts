/*
  Seção "Pendências" do /socios (ordem bd296d53, item 5): lista o que espera a aprovação do Daniel,
  sem dado pessoal. Roda: node --test src/lib/socios/pendencias.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { pendenciasParaSocios, type LinhaPendencia } from "./pendencias.ts";

const agora = new Date("2026-10-11T12:00:00Z");
const base: LinhaPendencia = {
  tipo: "merge_pr",
  referencia: "PR #341",
  resumo: "Cartões de aprovação no chat",
  risco: "baixo",
  status: "pendente",
  expira_em: "2026-10-12T12:00:00Z",
};

test("só entra o que está pendente e não expirou", () => {
  const r = pendenciasParaSocios(
    [
      base,
      { ...base, referencia: "PR #1", status: "aprovada" },
      { ...base, referencia: "PR #2", expira_em: "2026-10-10T12:00:00Z" },
    ],
    agora,
  );
  assert.deepEqual(r.map((p) => p.referencia), ["PR #341"]);
  assert.equal(r[0].tipo, "Mesclar PR");
});

test("remove CPF, e-mail e telefone do resumo e limita o tamanho", () => {
  const r = pendenciasParaSocios(
    [{ ...base, resumo: "Aprovar doc de joao@exemplo.com CPF 123.456.789-09 tel (34) 99999-8888 " + "x".repeat(400) }],
    agora,
  );
  assert.ok(!/@|123\.456|99999/.test(r[0].resumo));
  assert.ok(r[0].resumo.length <= 160);
});

test("lista vazia ou nula não quebra", () => {
  assert.deepEqual(pendenciasParaSocios([], agora), []);
  assert.deepEqual(pendenciasParaSocios(null, agora), []);
});

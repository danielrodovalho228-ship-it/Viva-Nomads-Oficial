/*
  E1044 (ORDEM-DUET-237; evidência no E1020): a lista "Pagamentos para confirmar" do morador (e a do dono) vinha de
  pagamentos_bloco embutido SEM ORDER BY — a ordem era a do armazenamento do Postgres e mudava a cada UPDATE (no lab, um
  UPDATE que regravava o mesmo valor levou a Caução de 1.ª a última). O admin já ordena por data_pagamento
  (contrato-admin.ts). Agora as duas listas de contratos-actions.ts passam por ordenarPagamentos: data_pagamento, e no
  empate (a data é só o dia) created_at e id — a mesma ordem em qualquer recarga.
  Roda: node --test src/lib/pagamentos/e1044-ordem-pagamentos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ordenarPagamentos } from "./ordem-pagamentos.ts";

const P = [
  { id: "c", data_pagamento: "2026-11-20", created_at: "2026-11-20T10:00:03Z", tipo: "caucao" },
  { id: "a", data_pagamento: "2026-11-20", created_at: "2026-11-20T10:00:01Z", tipo: "aluguel" },
  { id: "b", data_pagamento: "2026-11-20", created_at: "2026-11-20T10:00:02Z", tipo: "aluguel" },
  { id: "d", data_pagamento: "2026-10-01", created_at: "2026-11-20T10:00:09Z", tipo: "aluguel" },
];

function permutacoes<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutacoes([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r]));
}

test("E1044 — ordena por data do pagamento; no mesmo dia, por quando foi registrado", () => {
  assert.deepEqual(ordenarPagamentos(P).map((p) => p.id), ["d", "a", "b", "c"]);
});

test("E1044 — a mesma ordem em qualquer ordem de chegada (o banco não garante nenhuma)", () => {
  for (const chegada of permutacoes(P)) assert.deepEqual(ordenarPagamentos(chegada).map((p) => p.id), ["d", "a", "b", "c"]);
});

test("E1044 — não altera a lista recebida e aguenta campos em falta", () => {
  const copia = [...P];
  ordenarPagamentos(P);
  assert.deepEqual(P, copia);
  assert.deepEqual(ordenarPagamentos([{ id: "y" }, { id: "x" }]).map((p) => p.id), ["x", "y"]);
});

test("E1044 — as duas listas de contratos-actions.ts (morador e dono) passam pela ordem", () => {
  const src = readFileSync("src/lib/data/contratos-actions.ts", "utf8");
  const listas = src.match(/const pagamentos = [^\n]*pagamentos_bloco[^\n]*/g) ?? [];
  assert.equal(listas.length, 2, "as duas listas");
  for (const l of listas) assert.match(l, /ordenarPagamentos\(/, l);
});

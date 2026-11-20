import { test } from "node:test";
import assert from "node:assert/strict";
import { leadSummary, type Lead } from "./lead-types.ts";

// E670: a linha sob o nome do candidato mostrava "— · atenção": categoria vazia como traço + selo sem motivo.
const base = { id: "1", name: "Candidato(a)", property: "Apto", category: "—", riskCategories: [], light: "yellow", verified: false } as Lead;

test("E670: categoria vazia ('—') não entra e 'atenção' sem motivo some — resumo vazio", () => {
  assert.equal(leadSummary(base), "");
  assert.doesNotMatch(leadSummary({ ...base, category: "  " }), /—|atenção/);
});

test("E670: 'atenção' só com o motivo concreto", () => {
  assert.equal(leadSummary({ ...base, riskCategories: ["Identidade pendente", "Renda a confirmar", "Terceiro"] }), "atenção: Identidade pendente, Renda a confirmar");
});

test("E670: verde e vermelho seguem dizendo o semáforo; categoria real aparece", () => {
  assert.equal(leadSummary({ ...base, category: "Médica · residência", light: "green" }), "Médica · residência · perfil limpo");
  assert.equal(leadSummary({ ...base, light: "red" }), "alto risco");
});

test("E670: com período e orçamento, a linha continua sem traço solto", () => {
  assert.equal(leadSummary({ ...base, desiredPeriodDays: 90, budgetMatch: true }), "quer 90 dias · orçamento ok");
});

test("E670: as telas escondem a linha quando o resumo é vazio", async () => {
  const { readFileSync } = await import("node:fs");
  assert.match(readFileSync("src/app/(dashboard)/dashboard/leads/leads-client.tsx", "utf8"), /leadSummary\(l\) && <p /);
  assert.match(readFileSync("src/app/(dashboard)/dashboard/leads/[id]/page.tsx", "utf8"), /leadSummary\(l\) && <p /);
});

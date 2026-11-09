import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: o h1 da inicial do admin é o rótulo do menu ("Visão geral"); "Hoje você tem N decisões" saiu da inicial (E176/E474).
test("t56 espera o h1 atual da inicial do admin", () => {
  assert.match(readFileSync("src/config/menu-admin.ts", "utf8"), /folha\("admin-painel", "Visão geral", "\/admin"/);
  assert.match(readFileSync("src/app/(dashboard)/admin/page.tsx", "utf8"), /title=\{rotuloDoAdmin\("\/admin"\)\}/);
  assert.match(readFileSync("tests/e2e/specs/t56-admin-aal2.spec.ts", "utf8"), /toHaveText\("Visão geral"/);
});

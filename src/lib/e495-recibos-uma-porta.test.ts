/** E495 (rodada do proprietário, 02/11): "Recibos e notas" tinha duas portas — cartão em Ferramentas e o menu de
 *  Contratos, mesmo destino /dashboard/recibos. Fica UMA: Contratos › Recibos e notas. `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ABAS_PROPRIETARIO } from "../config/abas-painel.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const FERRAMENTAS = ler("app/(dashboard)/dashboard/ferramentas/page.tsx");

test("Ferramentas não leva mais a /dashboard/recibos (nem cartão, nem atalho do informe)", () => {
  assert.doesNotMatch(FERRAMENTAS, /href[=:]\s*["{`]?\/dashboard\/recibos/);
  assert.doesNotMatch(FERRAMENTAS, /titulo: "Recibos e notas"/);
});

test("a porta que fica: Contratos › Recibos e notas", () => {
  const sub = ABAS_PROPRIETARIO.find((a) => a.id === "contratos")!.subabas!.filter((s) => s.href === "/dashboard/recibos");
  assert.equal(sub.length, 1);
  assert.equal(sub[0].rotulo, "Recibos e notas");
});

test("grade par: grupo com número ímpar de cartões estica o último na linha inteira", () => {
  assert.match(FERRAMENTAS, /sm:\[&>:last-child:nth-child\(odd\)\]:col-span-full/);
});

/*
  E72 (QA do Muse, 24/10): o cartão "Candidaturas" do painel do morador estava fixo em "0" (só a demonstração tinha
  número). Guarda: o cartão mostra o tamanho da MESMA lista de /dashboard/candidaturas (listMinhasCandidaturas).
  Roda: node --test src/lib/painel/cartao-candidaturas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("o painel lê listMinhasCandidaturas e passa o total ao cartão", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/page.tsx");
  assert.match(pagina, /import \{ listMinhasCandidaturas \} from "@\/lib\/data\/leads-actions";/);
  assert.match(pagina, /listMinhasCandidaturas\(\)\.catch\(\(\) => \[\]\)/);
  assert.match(pagina, /totalCandidaturas=\{candidaturas\.length\}/);
});

test("a lista da tela de candidaturas usa a mesma função", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/candidaturas/page.tsx"), /listMinhasCandidaturas\(\)/);
});

test("o cartão não é mais um número fixo", () => {
  const cliente = ler("src/app/(dashboard)/dashboard/visao-geral-client.tsx");
  assert.match(cliente, /<StatCard label="Candidaturas" value=\{demo \? "2" : String\(totalCandidaturas\)\}/);
  assert.match(cliente, /<TenantDashboard [^>]*totalCandidaturas=\{totalCandidaturas\}/);
});

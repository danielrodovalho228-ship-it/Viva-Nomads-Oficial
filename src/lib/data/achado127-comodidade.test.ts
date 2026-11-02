/*
  Frente 1, rodada 4 — achado 127 (média-baixa): a comodidade confirmada na sugestão das fotos (página do nível) lia
  se o anúncio já tinha a comodidade sem conferir o erro. Na falha, gravava de novo e o anúncio passava a mostrar a
  comodidade em dobro (property_amenities não tem índice único por imóvel + rótulo). Agora as duas leituras conferem o
  erro antes de gravar e devolvem ok: false.
  Roda: node --test src/lib/data/achado127-comodidade.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./comodidade-sugerida-actions.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export async function gravarComodidadeConfirmada"));

test("comodidade confirmada: sem conferir se já existe, não grava (nada em dobro)", () => {
  const insert = fn.indexOf('.from("property_amenities").insert(');
  assert.ok(insert > 0);
  const g1 = fn.indexOf("if (erroJa) return { ok: false };");
  const g2 = fn.indexOf("if (erroConta) return { ok: false };");
  assert.ok(g1 > 0 && g1 < insert, "a leitura de 'já existe' confere o erro antes de gravar");
  assert.ok(g2 > 0 && g2 < insert, "a contagem confere o erro antes de gravar");
  assert.ok(g1 < fn.indexOf("if (data) return { ok: true };"), "o erro é conferido antes de concluir que não existe");
});

test("página do nível: comodidade que não foi gravada desmarca (o dono não vê 'salvo' sem estar)", () => {
  const t = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/[id]/nivel/sugestoes-no-nivel.tsx", import.meta.url), "utf8");
  assert.match(t, /gravarComodidadeConfirmada\(propertyId, chave\)\.then\(\(r\) => \{\s*if \(!r\.ok && !jaTinha\) setMarcadas\(\(m\) => m\.filter\(\(k\) => k !== chave\)\);/);
});

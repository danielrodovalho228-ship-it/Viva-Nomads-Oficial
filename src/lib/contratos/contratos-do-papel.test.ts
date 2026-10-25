/* Roda: node --test src/lib/contratos/contratos-do-papel.test.ts — E188 (a página do papel só mostra dados do papel). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("modo dono em Contratos: só os contratos do dono; os de morador viram um atalho para o modo morador", () => {
  const modo = ler("src/app/(dashboard)/dashboard/contratos/contratos-por-modo.tsx");
  // A lista de morador não é mais montada no modo dono (nada de vazio do dono acima de uma lista com itens).
  assert.doesNotMatch(modo, /temInquilino && <div className="mt-12">\{inquilino\}<\/div>/);
  assert.match(modo, /data-testid="contratos-atalho-morador"/);
  assert.match(modo, /setActiveMode\("tenant"\)/);
});

test("Caução do dono: o vazio diz que são os imóveis do dono", () => {
  const caucao = ler("src/app/(dashboard)/dashboard/garantias/garantias-client.tsx");
  assert.match(caucao, /title="Nenhuma caução dos seus imóveis ainda"/);
  assert.doesNotMatch(caucao, /title="Nenhuma caução ainda"/);
});

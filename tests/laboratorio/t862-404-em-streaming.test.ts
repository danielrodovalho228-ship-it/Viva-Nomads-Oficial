import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

// Lab 10/11 (head 42a48ade0): t862 "outra conta não vê o perfil" esperava HTTP 404 e recebeu 200. O painel tem
// src/app/(dashboard)/dashboard/loading.tsx, então a resposta já sai em streaming com 200 e o notFound() troca o conteúdo
// pela tela "Página não encontrada" (docs do Next: loading.md, "Status codes"). Mesmo padrão de t193/t327/t593.
// A proteção que importa é o perfil NÃO aparecer para outra conta; esta guarda impede a volta do 404 estrito.
test("t862: outra conta recebe a tela de não encontrada (200 ou 404 por causa do streaming), nunca o perfil", () => {
  assert.ok(existsSync("src/app/(dashboard)/dashboard/loading.tsx"), "o painel faz streaming");
  const spec = readFileSync("tests/e2e/specs/t862-e553-perfil-candidato.spec.ts", "utf8");
  const t2 = spec.slice(spec.indexOf('test("2.'));
  assert.doesNotMatch(t2, /expect\(r\?\.status\(\)\)\.toBe\(404\)/);
  assert.match(t2, /\[200, 404\]/);
  assert.match(t2, /Página não encontrada/);
  assert.match(t2, /getByTestId\("perfil-candidato"\)\)\.toHaveCount\(0\)/);
});

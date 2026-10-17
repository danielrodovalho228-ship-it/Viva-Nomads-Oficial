/*
  Lab 0ede9c2 (t115): com rascunho no servidor a tela mostra o aviso "anúncio em andamento" em vez de aplicar o
  rascunho local, e a etapa "Tipo" (onde fica "Importar meu anúncio") nunca abria. O spec precisa achar o aviso
  pelo data-testid e abrir o rascunho já na etapa 0 (?etapa=0).
  Roda: node --test "src/app/(dashboard)/dashboard/imoveis/novo/rascunho-banner.test.ts"
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagina = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const spec = readFileSync(new URL("../../../../../../tests/e2e/specs/t115-importar-anuncio.spec.ts", import.meta.url), "utf8");

test("aviso de rascunho em andamento e seu botão Continuar têm data-testid", () => {
  assert.match(pagina, /data-testid="rascunho-aviso"/);
  assert.match(pagina, /data-testid="rascunho-continuar"/);
});

test("t115 não depende de a tela já ter carregado o aviso: espera o aviso OU o botão e abre a etapa 0", () => {
  assert.match(spec, /rascunho-continuar/);
  assert.match(spec, /etapa=0/);
  assert.doesNotMatch(spec, /isVisible\(\)\.catch/);
});

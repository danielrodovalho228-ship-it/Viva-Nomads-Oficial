import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lab 70f874c: t102 estourava 45 s porque /Continuar|Retomar/ casava com o "Continuar" do rodapé do cadastro.
test("t102: o botão de retomar rascunho é buscado dentro do aviso, não por regex solta", () => {
  const spec = readFileSync("tests/e2e/specs/t102-preco-sugerido.spec.ts", "utf8");
  assert.ok(!/name:\s*\/Continuar\|Retomar\//.test(spec));
  assert.match(spec, /Você tem um anúncio em andamento/);
});

// Lab 8b32a4e: o id do usuário não está no localStorage (a sessão fica em cookie), então o rascunho nunca era gravado
// e o passo de preço não abria. A spec lê o cookie sb-*-auth-token.
test("t102: o id do usuário vem do cookie de sessão, não do localStorage", () => {
  const spec = readFileSync("tests/e2e/specs/t102-preco-sugerido.spec.ts", "utf8");
  assert.match(spec, /context\.cookies\(\)/);
  assert.ok(!/localStorage\)\.find/.test(spec));
});

// Lab 8b32a4e: t69 a 768 px estourava 240 s esperando o "load" do mapa; a espera é só o HTML e o primeiro [data-cta].
test("t69: a varredura de botões não espera o evento load das páginas", () => {
  const spec = readFileSync("tests/e2e/specs/t69-botoes-header.spec.ts", "utf8");
  assert.ok(!/waitForLoadState\("load"\)/.test(spec));
});

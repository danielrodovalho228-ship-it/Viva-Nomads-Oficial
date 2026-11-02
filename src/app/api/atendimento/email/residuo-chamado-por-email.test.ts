import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: leitura falha nunca transforma a resposta por e-mail em chamado novo. */
const f = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("e-mail de atendimento: erro ao ler o perfil ou o chamado devolve 503 antes de criar chamado", () => {
  const p = f.indexOf("if (erroPerfil) return NextResponse.json(");
  const c = f.indexOf("if (erroChamado) return NextResponse.json(");
  const novo = f.indexOf('.from("chamados")\n    .insert(');
  assert.ok(p >= 0 && c >= 0 && novo >= 0);
  assert.ok(p < novo && c < novo, "antes do chamado novo");
  assert.ok(c < f.indexOf('from("chamado_mensagens").insert('), "antes de responder ao chamado");
  assert.match(f, /status: 503/);
});

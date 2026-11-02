import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Resíduo da varredura ampla: o aceite da candidatura nunca pula a checagem de datas por leitura falha, e só o
 * aceite que mudou o status avisa o morador.
 */
const fonte = readFileSync(new URL("./leads-actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function aceitarCandidatura(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("leitura falha da entrada desejada para antes da checagem de datas (achado 46)", () => {
  assert.ok(i >= 0);
  const guarda = f.indexOf("if (erroDatas) return { ok: false, error: MSG_DATAS_SEM_CONFERIR };");
  assert.ok(guarda >= 0, "guarda da leitura");
  assert.ok(guarda < f.indexOf("conflitoNoImovel("), "antes da checagem");
  assert.ok(guarda < f.indexOf('status: "accepted"'), "antes do aceite");
  assert.match(fonte, /import \{ conflitoNoImovel, MSG_DATAS_SEM_CONFERIR \} from "@\/lib\/data\/periodo-servidor";/);
});

test("o aceite confere a linha mudada antes de avisar o morador", () => {
  assert.match(f, /\.eq\("status", "new"\)\s*\.select\("id"\);/);
  const checa = f.indexOf("if (!aceitou?.length) return");
  assert.ok(checa >= 0, "confere a linha");
  assert.ok(checa < f.indexOf('event: "candidatura_aceita"'), "antes do e-mail");
});

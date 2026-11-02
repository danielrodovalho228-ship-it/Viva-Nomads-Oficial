/*
  Frente 1, rodada 4 — achado 125 (média, LGPD): o envio do comprovante de vínculo (triagem) lia a candidatura aceita e
  o último comprovante sem conferir o erro. Sem o último comprovante, o pendente anterior não era achado: ficavam dois
  pendentes e o arquivo antigo (documento pessoal) órfão no Storage; a trava de "vínculo já confirmado" também caía.
  Agora as duas leituras recusam com 503 ANTES de gravar qualquer arquivo.
  Roda: node --test src/lib/triagem/achado125-upload.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../app/api/upload/triagem-vinculo/route.ts", import.meta.url), "utf8");

test("upload do comprovante: as leituras recusam com 503 antes do upload", () => {
  for (const e of ["e1", "e2"]) {
    const i = src.indexOf(`if (${e}) return NextResponse.json({ error: MSG_SEM_LEITURA }, { status: 503 });`);
    assert.ok(i > 0, e);
    assert.ok(i < src.indexOf(".storage.from(BUCKET_TRIAGEM).upload("), `${e} antes do upload`);
  }
  assert.ok(src.indexOf("if (e2)") < src.indexOf("if (!podeEnviar("), "a trava de confirmado usa a leitura conferida");
});

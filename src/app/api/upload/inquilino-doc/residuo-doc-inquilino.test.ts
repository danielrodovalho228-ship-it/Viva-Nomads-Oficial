import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: documento anterior ilegível nunca deixa o arquivo substituído órfão no bucket. */
const f = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("upload do documento do inquilino: erro ao ler o anterior desfaz o envio antes do upsert", () => {
  const g = f.indexOf("if (erroAnterior) {");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf('.from("documentos_inquilino")\n    .upsert('), "antes do upsert");
  assert.match(f.slice(g, g + 300), /storage\.from\(BUCKET_DOCS_INQUILINO\)\.remove\(\[caminho\]\);\s*return NextResponse\.json\(/);
});

/*
  Estados vazios — pacote anual dos recibos (/api/recibos/ano): falha ao ler os caminhos dos PDFs, ou ao baixar um
  deles, NÃO gera um ZIP incompleto em silêncio (é o pacote que vai para o imposto de renda). Responde 503 com aviso.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("pdfsDosDocumentos lança no erro de leitura (não devolve lista vazia)", () => {
  const src = ler("./recibos.ts");
  const i = src.indexOf("export async function pdfsDosDocumentos(");
  const f = src.slice(i, src.indexOf("\n}\n", i));
  assert.match(f, /const \{ data, error \} = await/);
  assert.match(f, /if \(error\) throw new Error\(MSG_PDFS_SEM_LEITURA\);/);
  assert.match(src, /export const MSG_PDFS_SEM_LEITURA = "[^"]*Tente de novo/);
});

test("rota do ano: leitura ou download falhou → 503, nunca ZIP sem os recibos", () => {
  const rota = ler("../../app/api/recibos/[relatorio]/route.ts");
  assert.ok(rota.includes("const caminhos = await pdfsDosDocumentos(doAno.map((r) => r.id)).catch(() => null);\n    if (!caminhos) return erro(503, MSG_PDFS_SEM_LEITURA);"));
  assert.match(rota, /if \(!data\) return erro\(503, MSG_PDFS_SEM_LEITURA\);/);
  assert.doesNotMatch(rota, /if \(data\) arquivos\.push/);
});

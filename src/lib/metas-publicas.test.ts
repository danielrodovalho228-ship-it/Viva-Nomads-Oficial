import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { descricaoCidade } from "./cidades-meta.ts";

// Ordem 49c2dbef (achado do Moacir no #730): meta description acima de 155 caracteres é cortada no Google.
const LIMITE = 155;

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? arquivos(join(dir, e.name)) : [join(dir, e.name)],
  );
}

test("descrição da cidade cabe em 155 caracteres, também com nome de cidade longo", () => {
  for (const nome of ["Uberlândia", "Belo Horizonte", "Governador Valadares", "São José do Rio Preto", "Campos dos Goytacazes"]) {
    const d = descricaoCidade(nome);
    assert.ok(d.length <= LIMITE, `${nome}: ${d.length} caracteres`);
    assert.match(d, new RegExp(nome));
    assert.match(d, /30 a 180 dias/);
  }
});

test("toda description literal das páginas públicas tem no máximo 155 caracteres", () => {
  const achados: string[] = [];
  for (const f of arquivos("src/app/(public)").filter((p) => /(page|layout)\.tsx$/.test(p))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/description:\s*("(?:[^"\\]|\\.)*")/g)) {
      const texto = JSON.parse(m[1]) as string;
      if (texto.length > LIMITE) achados.push(`${f}: ${texto.length}`);
    }
  }
  assert.deepEqual(achados, []);
});

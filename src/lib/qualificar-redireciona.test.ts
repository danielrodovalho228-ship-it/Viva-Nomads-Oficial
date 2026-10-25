import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const raiz = join(process.cwd(), "src");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.tsx$/.test(nome) ? [caminho] : [];
  });
}

test("/qualificar sem ?imovel= redireciona (servidor) para o cadastro novo (E132-A)", () => {
  const page = readFileSync(join(raiz, "app/(dashboard)/qualificar/page.tsx"), "utf8");
  assert.doesNotMatch(page, /"use client"/);
  assert.match(page, /if \(!id\) redirect\(destinoQualificarSemImovel\(\)\)/);
  assert.match(page, /searchParams/);
});

test("nenhuma tela leva ao /qualificar sem ?imovel=", () => {
  const ruins = arquivos(raiz).filter((f) => {
    if (f.includes("qualificar/page.tsx")) return false;
    const src = readFileSync(f, "utf8");
    return /href=\{?["'`]\/qualificar["'`]/.test(src) || /href:\s*"\/qualificar"/.test(src);
  });
  assert.deepEqual(ruins, []);
});

test("estado vazio de Meus imóveis começa pelas fotos", () => {
  const src = readFileSync(join(raiz, "app/(dashboard)/dashboard/imoveis/imoveis-client.tsx"), "utf8");
  assert.match(src, /Comece pelas fotos do seu imóvel/);
  assert.match(src, /Cadastrar imóvel/);
  assert.doesNotMatch(src, /Qualificar imóvel/);
});

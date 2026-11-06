/*
  E640 (a) — fotos PÚBLICAS com proteção LEVE (decisão do Daniel, 05/11/2026 20:41: sem marca d'água visível nas fotos
  públicas; aprovado "seguir o recomendado" às 20:42):
   • sem EXIF/GPS e nunca o original — o servidor re-codifica e só guarda a versão em resolução de tela;
   • sem clique-direito nem arrastar;
   • NADA de bloquear print e NENHUM texto público prometendo "impossível fazer print" ou "sai embaralhada".
  Roda: node --test src/lib/fotos/e640a-protecao-leve.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FOTO_LADO_MAX_PX } from "../foto-reconversao.ts";

const RAIZ = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f)) acc.push(p);
  }
  return acc;
}

test("a foto pública é guardada em resolução de tela (full HD), nunca no tamanho do original", () => {
  assert.equal(FOTO_LADO_MAX_PX, 1920);
  const rota = ler("app/api/upload/foto/route.ts");
  assert.match(rota, /reconverterFotoParaWebp\(bytes\)/);
  assert.match(rota, /sem EXIF\/GPS/);
});

test("o servidor não copia metadados (EXIF/GPS) para a foto salva", () => {
  const r = ler("lib/foto-reconversao.ts");
  assert.match(r, /\.rotate\(\)/);
  assert.match(r, /\.webp\(\{ quality: FOTO_QUALIDADE_WEBP \}\)/);
  assert.doesNotMatch(r, /withMetadata|keepExif|keepMetadata/, "nada que preserve metadados");
});

test("sem clique-direito e sem arrastar nas fotos públicas (BrandImage)", () => {
  const b = ler("components/brand-image.tsx");
  assert.match(b, /onContextMenu=\{\(e\) => e\.preventDefault\(\)\}/);
  assert.match(b, /onDragStart=\{\(e\) => e\.preventDefault\(\)\}/);
  assert.match(b, /draggable=\{false\}/);
  assert.match(b, /select-none/);
});

test("nenhum texto público promete bloquear print ou embaralhar a imagem", () => {
  const proibidos = [/imposs[ií]vel\s+(fazer|tirar)\s+(um\s+)?print/i, /embaralhad/i, /bloque(amos|ia|ado)\s+(o\s+)?print/i, /print\s+(bloqueado|proibido)/i, /n[aã]o\s+(d[aá]|é poss[ií]vel)\s+(para\s+)?(tirar|fazer)\s+print/i];
  const achados: string[] = [];
  for (const arq of [...arquivos(join(RAIZ, "app")), ...arquivos(join(RAIZ, "components")), ...arquivos(join(RAIZ, "config"))]) {
    const s = readFileSync(arq, "utf8");
    for (const re of proibidos) if (re.test(s)) achados.push(`${arq.replace(RAIZ, "")}: ${re}`);
  }
  assert.deepEqual(achados, []);
});

test("sem marca d'água visível nas fotos públicas (decisão do Daniel)", () => {
  const b = ler("components/brand-image.tsx") + ler("components/property-gallery.tsx");
  assert.doesNotMatch(b, /marca d['’]?água|watermark/i);
});

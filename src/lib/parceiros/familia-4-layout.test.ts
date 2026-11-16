/*
  Família 4 — fotos e layout (RELATORIO-L-045, ORDEM-L-050). Um teste nomeado por item; vermelho na main, verde no PR.
  E909+E932 (foto própria da Montagem) espera o arquivo da foto — fora deste lote (ver o PR).
  Roda: node --test src/lib/parceiros/familia-4-layout.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { TEMAS_AJUDA } from "../ajuda/temas.ts";
import { fotoDaCategoria } from "../../config/fotos-categorias-parceiro.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("E911 — /parceiros/fotografos abre com foto (BannerTopo com a foto do fotógrafo), o h1 continua 'Fotógrafos parceiros'", () => {
  const p = ler("src/app/(public)/parceiros/fotografos/page.tsx");
  assert.match(p, /<BannerTopo[\s\S]{0,200}foto=\{foto\.src\}/);
  assert.match(p, /titulo="Fotógrafos parceiros"/);
  const f = fotoDaCategoria("fotografia")!;
  assert.ok(existsSync(`public${f.src}`), f.src);
});

test("E912 — o tema da Ajuda abre com a sua foto e cada 'Outro tema' tem a foto do cartão", () => {
  const p = ler("src/app/(public)/ajuda/[tema]/page.tsx");
  assert.match(p, /data-testid="ajuda-tema-foto"[\s\S]{0,120}<Image src=\{tema\.foto\}/);
  assert.match(p, /data-testid=\{`ajuda-outro-tema-\$\{t\.id\}`\}[\s\S]{0,300}<Image src=\{t\.foto\}/);
  for (const t of TEMAS_AJUDA) assert.ok(existsSync(`public${t.foto}`), t.foto);
});

test("E913 — o logo do rodapé assenta direto no preto, sem a placa branca; a barra lateral escura mantém a placa", () => {
  assert.match(ler("src/components/layout/footer.tsx"), /<Logo href="\/" light placa=\{false\} \/>/);
  const logo = ler("src/components/ui/logo.tsx");
  assert.match(logo, /placa = true/);
  assert.match(logo, /<BrandMark onDark=\{light && placa\} \/>/);
});

test("E914 — a grade 'Como funciona' de /parceiros/avaliadores é 2+2 (nunca 3+1 a 1280 px)", () => {
  const p = ler("src/app/(public)/parceiros/avaliadores/page.tsx");
  const grade = /<ul className="([^"]+)" data-testid="avaliador-como-grade">/.exec(p);
  assert.ok(grade, "grade marcada");
  assert.match(grade[1], /sm:grid-cols-2/);
  assert.doesNotMatch(grade[1], /grid-cols-3/);
});

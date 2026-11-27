/**
 * E505 (D-S1-17): nas miniaturas dos temas da Central de Ajuda, as fotos saíam borradas e a de "Segurança e conta"
 * cinza. Causas: (1) sizes="80px" descrevia a CAIXA, mas a foto larga em object-cover ocupa 80 px × proporção — o
 * navegador baixava uma versão pequena e a esticava (1,7× numa tela 2×); (2) o recorte central da foto larguíssima de
 * "Segurança e conta" (1600×600) caía na parte branca do cartão. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEMAS_AJUDA } from "./temas.ts";

/** Largura × altura de um .webp (VP8, VP8L, VP8X). */
function tamanhoWebp(caminho: string): [number, number] {
  const b = readFileSync(caminho);
  const i = b.indexOf("VP8");
  const tipo = b.toString("ascii", i, i + 4);
  if (tipo === "VP8X") return [1 + b.readUIntLE(i + 12, 3), 1 + b.readUIntLE(i + 15, 3)];
  if (tipo === "VP8 ") return [b.readUInt16LE(i + 14) & 0x3fff, b.readUInt16LE(i + 16) & 0x3fff];
  const v = b.readUInt32LE(i + 9);
  return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1];
}

const pagina = readFileSync(new URL("../../app/(public)/ajuda/page.tsx", import.meta.url), "utf8");

test("o sizes da miniatura cobre a largura real da foto recortada (80 px × proporção), para não esticar", () => {
  const sizes = Number(pagina.match(/<Image\s+src=\{t\.foto\}[^>]*sizes="(\d+)px"/)?.[1] ?? 0);
  for (const t of TEMAS_AJUDA) {
    const [w, h] = tamanhoWebp(new URL(`../../../public${t.foto}`, import.meta.url).pathname);
    assert.ok(sizes >= Math.ceil((80 * w) / h), `${t.id}: sizes ${sizes}px < ${Math.ceil((80 * w) / h)}px (foto ${w}×${h})`);
  }
});

test("'Segurança e conta': o recorte mostra o cartão com o chip, não a parte branca", () => {
  const seg = TEMAS_AJUDA.find((t) => t.id === "seguranca")!;
  assert.equal(seg.fotoPosicao, "35% 50%");
  assert.match(pagina, /style=\{t\.fotoPosicao \? \{ objectPosition: t\.fotoPosicao \} : undefined\}/);
});

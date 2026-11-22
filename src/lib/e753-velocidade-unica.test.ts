/*
  E753 (Phoenix RELATORIO-004 C2, reconfirmado no RELATORIO-013 de 12/11; evidência do RELATORIO-011): o mesmo anúncio dizia
  "Internet fibra 200 Mbps" nas comodidades e "Internet 100 Mbps" no Espaço de trabalho (ube-002). Regra:
   • FONTE ÚNICA da velocidade por anúncio: o campo internetMbps (a página o mostra como "informada pelo proprietário …
     (não medida)", ou a medida, quando há medição válida — textoInternet);
   • nunca afirmar como fato/medida a velocidade só declarada: nenhum texto livre do anúncio (comodidades, espaço de
     trabalho, grupos) carrega "N Mbps".
  Roda: node --test src/lib/e753-velocidade-unica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync("src/lib/properties.ts", "utf8");
/** Os blocos de cada anúncio de exemplo (id "ube-…"). */
const blocos = fonte
  .split(/\n  \{\n    id: "/)
  .slice(1)
  .map((b) => ({ id: b.slice(0, b.indexOf('"')), corpo: b }))
  .filter((b) => b.id.startsWith("ube-"));

/** Os textos livres do anúncio: amenities, workFeatures e os itens dos grupos. */
function textosLivres(corpo: string): string[] {
  const out: string[] = [];
  for (const campo of ["amenities", "workFeatures"]) {
    const m = corpo.match(new RegExp(`\\n    ${campo}: \\[([^\\]]*)\\]`));
    if (m) out.push(...[...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
  }
  for (const g of corpo.matchAll(/items: \[([^\]]*)\]/g)) out.push(...[...g[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
  return out;
}

test("há anúncios de exemplo para conferir", () => {
  assert.ok(blocos.length >= 15, `achou ${blocos.length}`);
});

test("nenhum texto livre de anúncio de exemplo afirma velocidade (N Mbps)", () => {
  const achados = blocos.flatMap((b) => textosLivres(b.corpo).filter((t) => /\d+\s*mbps/i.test(t)).map((t) => `${b.id}: ${t}`));
  assert.deepEqual(achados, []);
});

test("quem fala de internet tem a velocidade no campo único internetMbps (uma por anúncio)", () => {
  for (const b of blocos) {
    const falaDeInternet = textosLivres(b.corpo).some((t) => /internet/i.test(t));
    const campos = [...b.corpo.matchAll(/\n    internetMbps: (\d+),/g)].map((m) => Number(m[1]));
    if (falaDeInternet) assert.equal(campos.length, 1, `${b.id}: internetMbps uma vez`);
    if (campos.length) assert.ok(campos[0] > 0, b.id);
  }
});

test("ube-002: a velocidade é uma só (100 Mbps, a menor das duas que o anúncio afirmava — sem prometer além)", () => {
  const b = blocos.find((x) => x.id === "ube-002")!;
  assert.match(b.corpo, /\n    internetMbps: 100,/);
});

test("a página mostra a velocidade só pela linha de internet (informada × medida), nunca solta nas listas", () => {
  const ws = readFileSync("src/components/property/workspace-section.tsx", "utf8");
  assert.match(ws, /textoInternet\(property\.internetMedida, property\.internetMbps, new Date\(\)\)/);
  const im = readFileSync("src/lib/internet-medida.ts", "utf8");
  assert.match(im, /Internet informada pelo proprietário: \$\{mbps\(informadaMbps\)\} Mbps \(não medida\)/);
});

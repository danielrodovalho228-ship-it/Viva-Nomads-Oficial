/* Roda: node --test src/lib/fotos/e387-aviso-sai.test.ts — E387: o aviso do Passo 2 sai quando as fotos são tratadas; confirmação em massa disponível. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("E387: o erro gravado do Passo 2 (fotos) é limpo quando nada mais bloqueia o avanço", () => {
  const p = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
  assert.match(p, /const fotosBloqueiam = fotosBloqueiamAvanco\(passoFotos\);\s+useEffect\(\(\) => \{\s+if \(!fotosBloqueiam\) setErros\(\(e\) => \(e\.fotos \? semErro\(e, "fotos"\) : e\)\);\s+\}, \[fotosBloqueiam\]\);/);
});

test("E387: com 2 ou mais sinalizadas, a galeria oferece 'Todas são do imóvel' (confirmação expressa, com a data)", () => {
  const u = readFileSync("src/components/photo-uploader.tsx", "utf8");
  assert.match(u, /pendentes\.length >= 2 && \(/);
  assert.match(u, /testid="fotos-nao-imovel-confirmar-todas"/);
  assert.match(u, /onChange\(confirmarTodasPendentes\(photos\)\)/);
  assert.match(u, /aviso=\{`Confirmo que as \$\{pendentes\.length\} fotos sinalizadas mostram o imóvel anunciado\.`\}/);
});

/*
  PERTO-A — a tela do "O que tem por perto" (cadastro e página do imóvel). Roda: node --test src/lib/anuncio/perto-a.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_POR_CATEGORIA_PAGINA, ORDEM_CATEGORIAS_PAGINA } from "./proximidades.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("as 5 categorias na ordem fixa e até 3 por categoria", () => {
  assert.deepEqual([...ORDEM_CATEGORIAS_PAGINA], ["saude", "educacao", "trabalho", "mercado", "transporte"]);
  assert.equal(MAX_POR_CATEGORIA_PAGINA, 3);
});

test("cadastro: três estados (carregando / achou / não achou) e o aviso sem endereço, um por vez", () => {
  const b = ler("components/anuncio/blocos-cadastro.tsx");
  assert.match(b, /const estado = carregando \? "carregando" : temItens \? "achou" : buscou \? "vazio" : "aguardando";/);
  assert.match(b, /Procurando o que tem por perto do endereço…/);
  assert.match(b, /ORDEM_CATEGORIAS_PAGINA\.map\(\(c\) => \{\s*\/\/ O mais perto primeiro; até 3 por categoria\.\s*const daCategoria = itens!\.filter\(\(l\) => l\.categoria === c\)\.sort\(\(x, y\) => \(x\.distanciaM \?\? Infinity\) - \(y\.distanciaM \?\? Infinity\)\)\.slice\(0, MAX_POR_CATEGORIA_PAGINA\);/);
  assert.match(b, /Não achamos lugares por perto deste endereço\./);
  assert.match(b, /Adicionar um lugar/);
});

test("cadastro: cada lugar com o interruptor 'Mostrar' (padrão do toggle) e 'Está errado'", () => {
  const b = ler("components/anuncio/blocos-cadastro.tsx");
  assert.match(b, /<Switch checked=\{marcado\} onChange=\{onAlternar\} label=\{`Mostrar \$\{l\.nome\} no anúncio`\} testId="proximidade-mostrar" \/>/);
  assert.match(b, /data-testid="proximidade-errado"[\s\S]{0,40}Está errado/);
  assert.doesNotMatch(b, /aria-pressed=\{marcado\}/);
});

test("página do imóvel: agrupada pelas categorias, na mesma ordem; continua no máximo 4 antes do aceite", () => {
  const p = ler("components/property/location-nearby.tsx");
  assert.match(p, /ORDEM_CATEGORIAS_PAGINA\.filter\(\(c\) => proximities\.some\(\(p\) => p\.categoria === c\)\)/);
  assert.match(p, /data-testid=\{`perto-cat-\$\{c\}`\}/);
  assert.match(p, /const MAX_POIS_PUBLICOS = 4;/);
});

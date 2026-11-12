/* E777 — o resumo "R$ X em N meses" existe UMA vez (cartao-preco.ts) e é reusado por cartão, barra fixa, reserva e cartão lateral. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { resumoEmMeses } from "./cartao-preco.ts";

test("resumoEmMeses: plural e singular", () => {
  assert.match(resumoEmMeses(8900, 2), /^R\$\s?8\.900 em 2 meses$/);
  assert.match(resumoEmMeses(4100, 1), /^R\$\s?4\.100 em 1 mês$/);
});

test("nenhum outro arquivo escreve 'em N meses' à mão: todos usam resumoEmMeses", () => {
  const raiz = new URL("../", import.meta.url).pathname;
  const achados: string[] = [];
  const ler = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) ler(p); else if (/\.tsx?$/.test(n) && !/\.test\.ts$/.test(n) && !p.endsWith("cartao-preco.ts")) {
    const s = readFileSync(p, "utf8");
    if (/\}\s*em\s*(\$\{[^}]+\}|\{[^}]+\})\s*(meses|\$\{[^}]*m[eê]s)/.test(s) && !/financeiro|modelo-negocio/.test(p)) achados.push(p.slice(raiz.length));
  } } };
  ler(join(raiz, "lib")); ler(join(raiz, "components/property")); ler(join(raiz, "components"));
  assert.deepEqual(achados, []);
});

test("cartão, barra fixa, reserva e cartão lateral importam resumoEmMeses", () => {
  for (const f of ["lib/cartao-estadia.ts", "lib/barra-fixa-imovel.ts", "lib/reserva-imovel.ts", "components/property/price-card.tsx"]) {
    assert.match(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"), /resumoEmMeses/, f);
  }
});

// E756 (reprovado ao vivo em 11/11/2026, devolvido à Pista B; vigia 12/11: regra única de composição em todas as superfícies): com 1 mês o cartão lateral dizia o total do MÊS ("resumoEmMeses(preco.total, 1)"), sem as limpezas que a conta logo abaixo
// somava. Agora o total de 1 mês também vem de estadiaDoImovel (a mesma função do cartão da busca e da prévia do dono).
test("E744/E756: o cartão lateral da página do imóvel diz o total de 1 mês pela regra única (igual ao cartão da busca)", () => {
  const src = readFileSync(new URL("../components/property/price-card.tsx", import.meta.url), "utf8");
  assert.match(src, /estadiaDoImovel\(property, Math\.max\(1, meses\)\)/);
  assert.match(src, /resumoEmMeses\(estadia\.total, estadia\.meses\)/);
  assert.doesNotMatch(src, /resumoEmMeses\(preco\.total, 1\)/);
});

/*
  E877 (RELATORIO-022, A-118) — os cartões "Limpeza e manutenção" e "Montagem e mudança" de /parceiros prometiam
  "Página própria com serviços e cidades", mas o "Procurar" leva à busca filtrada (/parceiros/buscar?categoria=…).
  Precedente do E187: promessa e destino dizem a mesma coisa. Só Fotografia tem página própria (/parceiros/fotografos).
  Roda: node --test src/lib/parceiros/e877-promessa-destino.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const PAGINA = ler("src/app/(public)/parceiros/page.tsx");
const cartao = (id: string, proximo: string) => PAGINA.slice(PAGINA.indexOf(`id: "${id}"`), PAGINA.indexOf(`id: "${proximo}"`));

test("os cartões de serviço prometem o que a busca entrega (serviço + cidade/CEP + perfil), não uma página própria", () => {
  for (const [id, prox] of [["servicos", "mobilia"], ["mobilia", "seguros"]]) {
    const c = cartao(id, prox);
    assert.doesNotMatch(c, /Página própria/, id);
    assert.match(c, /Busca de profissionais por serviço e cidade \(ou CEP\), com o perfil de cada um\./, id);
    assert.match(c, /href: "\/parceiros\/buscar\?categoria=/, `${id}: o destino é a busca filtrada`);
  }
});

test("a busca entrega a promessa: filtra por categoria e cidade/CEP, e cada resultado abre o perfil do parceiro", () => {
  const busca = ler("src/app/(public)/parceiros/buscar/page.tsx");
  assert.match(busca, /buscarParceiros\(\{ categoria, cidade: sp\.cidade, uf: sp\.uf, cep: sp\.cep/);
  assert.match(ler("src/components/parceiros/cartao-parceiro.tsx"), /href=\{`\/parceiros\/\$\{p\.slug\}/);
});

test("só quem tem página própria de verdade promete página: Fotógrafos → /parceiros/fotografos (existe)", () => {
  const foto = cartao("fotografos", "empresas");
  assert.match(foto, /href: "\/parceiros\/fotografos"/);
  assert.ok(existsSync("src/app/(public)/parceiros/fotografos/page.tsx"));
  assert.equal((PAGINA.match(/Página própria/g) ?? []).length, 0, "nenhum cartão promete 'Página própria' sem tê-la");
});

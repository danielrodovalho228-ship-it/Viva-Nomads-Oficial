/*
  E1080 (ORDEM-DUET-443 §3, DUET-1561): o cartão "Avaliação do imóvel" da grade de Serviços estava sem foto (ícone
  solitário entre cartões com foto — defeito pela regra do Daniel). Entra a foto escolhida pelo Daniel (Opção 3, gerada no
  Google Flow): mãos com um tablet e uma lista de vistoria, sem rosto e sem texto. Mesmo tema dos outros cartões:
  public/images/parceiros-categorias/, webp 800×600, ligada pelo fotoDaCategoria, na chave da categoria do avaliador
  ("vistoria", que continua fora do catálogo, da busca e do "Seja parceiro").
  Roda: node --test src/lib/vistoria/e1080-foto-cartao-avaliacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fotoDaCategoria } from "../../config/fotos-categorias-parceiro.ts";
import { CATEGORIAS_CATALOGO } from "../parceiros/regras.ts";

const raiz = (p: string) => new URL(`../../../${p}`, import.meta.url);

test("E1080: a categoria do avaliador tem a foto escolhida pelo Daniel, no tema dos outros cartões", () => {
  const foto = fotoDaCategoria("vistoria");
  assert.ok(foto, "a categoria vistoria tem foto");
  assert.equal(foto.src, "/images/parceiros-categorias/vistoria.webp");
  assert.equal(foto.alt, "Mãos segurando um tablet com uma lista de vistoria, dentro de um apartamento mobiliado");
  assert.equal(foto.provisoria, undefined, "é a foto própria da categoria, não provisória");
  const bytes = readFileSync(raiz(`public${foto.src}`));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "bd307b2e67d4782e87052aa8d5edd258875383f146f4aed40d1d75279b0dda24");
  // webp (RIFF…WEBP) e 800×600, como as outras fotos de parceiros-categorias.
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
});

test("E1080: o cartão 'Avaliação do imóvel' mostra a foto (como os outros cartões), não o ícone solitário", () => {
  const painel = readFileSync(raiz("src/components/parceiros/servicos-painel.tsx"), "utf8");
  const cartao = painel.slice(painel.indexOf('data-testid="servicos-avaliacao"'), painel.indexOf('data-testid="servicos-como-funciona"'));
  assert.match(cartao, /<Image\s+src=\{fotoAvaliacao\.src\}\s+alt=\{fotoAvaliacao\.alt\}/);
  assert.match(painel, /const fotoAvaliacao = fotoDaCategoria\("vistoria"\)!;/);
  assert.match(cartao, /data-testid="servicos-foto"/);
  assert.doesNotMatch(cartao, /<ClipboardCheck/);
});

test("E1080: a foto não põe a categoria do avaliador no catálogo de serviços", () => {
  assert.equal(CATEGORIAS_CATALOGO.some((c) => c.valor === "vistoria"), false);
});

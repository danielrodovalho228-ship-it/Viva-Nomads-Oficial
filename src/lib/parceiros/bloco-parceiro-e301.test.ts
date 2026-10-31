/* Roda: node --test src/lib/parceiros/bloco-parceiro-e301.test.ts — bloco parceiro do Muse (31/10): E301–E305. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { caminhoIndicacao, ufUnicaDaCidade } from "./indicacao.ts";
import { categoriaValida } from "./regras.ts";
import { GESTOR_PRECO } from "../../config/planos.ts";
import { FAIXAS_COMISSAO_PADRAO } from "../cobranca/regra.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const PARCEIROS = ler("src/app/(public)/parceiros/page.tsx");
const PRECOS = ler("src/app/(public)/precos/page.tsx");
const MUNICIPIOS = JSON.parse(ler("src/data/municipios-ibge.json")) as Record<string, string[]>;

test("E301: o cartão 'Montagem e mudança' leva às duas categorias, cada uma à sua busca e ao seu pedido", () => {
  const cartao = PARCEIROS.slice(PARCEIROS.indexOf('id: "mobilia"'), PARCEIROS.indexOf('id: "seguros"'));
  for (const c of ["montagem", "mudanca"]) {
    assert.ok(categoriaValida(c), c);
    assert.match(cartao, new RegExp(`/parceiros/buscar\\?categoria=${c}"`), `procurar ${c}`);
    assert.match(cartao, new RegExp(`/parceiros\\?categoria=${c}#quero-ser-parceiro"`), `atender ${c}`);
  }
});

test("E302: 'Ver o Plano Gestor' leva à âncora do Gestor em Preços, e ela existe", () => {
  assert.match(PARCEIROS, /\{ href: "\/precos#plano-gestor", rotulo: "Ver o Plano Gestor" \}/);
  assert.match(PRECOS, /id="plano-gestor"/);
  assert.match(PRECOS, /<h3 className="font-semibold text-ink">Plano Gestor<\/h3>/);
});

test("E303: o Gestor é 20+ (ou administradora); o 31+ é a faixa da taxa negociável — números distintos, ditos as duas vezes", () => {
  assert.equal(GESTOR_PRECO.minimoImoveis, 20);
  const negociavel = FAIXAS_COMISSAO_PADRAO.find((f) => f.negociavel)!;
  assert.equal(negociavel.minImoveis, 31);
  const secao = PRECOS.slice(PRECOS.indexOf('id="plano-gestor"'), PRECOS.indexOf('data-testid="precos-botoes"'));
  assert.match(secao, /\{GESTOR_PRECO\.minimoImoveis\} imóveis ou mais, ou é administradora/);
  assert.match(secao, /31\+ · \{ROTULO_FAIXA_NEGOCIAVEL\}/);
  assert.match(secao, /É outra regra/);
  assert.match(PARCEIROS, /\$\{GESTOR_PRECO\.minimoImoveis\} ou mais imóveis/);
});

test("E304: cidade sem UF habilita o aviso quando o nome é único; indicar manda o link do pedido de parceria", () => {
  assert.deepEqual(ufUnicaDaCidade("Uberlândia", MUNICIPIOS), { cidade: "Uberlândia", uf: "MG" });
  assert.deepEqual(ufUnicaDaCidade("uberlandia", MUNICIPIOS), { cidade: "Uberlândia", uf: "MG" });
  assert.equal(ufUnicaDaCidade("Bom Jesus", MUNICIPIOS), null, "ambígua: continua pedindo a UF");
  assert.equal(ufUnicaDaCidade("", MUNICIPIOS), null);
  assert.equal(caminhoIndicacao("limpeza"), "/parceiros?categoria=limpeza#quero-ser-parceiro");
  assert.equal(caminhoIndicacao(""), "/parceiros#quero-ser-parceiro");
  assert.equal(caminhoIndicacao("x?y"), "/parceiros#quero-ser-parceiro");
  const vazia = ler("src/components/parceiros/busca-vazia.tsx");
  assert.match(vazia, /<AvisoFotografo cidade=\{cidade\} uf=\{ufEfetiva\}/);
  assert.match(vazia, /<IndicarProfissional categoria=\{categoria\} \/>/);
  assert.doesNotMatch(vazia, /Abrir a página de parceiros/);
});

test("E305: a faixa 'É avaliador de imóveis?' tem foto", () => {
  const faixa = PARCEIROS.slice(PARCEIROS.indexOf('data-testid="parceiros-avaliador"'), PARCEIROS.indexOf("Ser avaliador credenciado"));
  assert.match(faixa, /data-testid="parceiros-avaliador-foto"[\s\S]*?<BrandImage src="\/images\/[^"]+" alt="[^"]{10,}"/);
});

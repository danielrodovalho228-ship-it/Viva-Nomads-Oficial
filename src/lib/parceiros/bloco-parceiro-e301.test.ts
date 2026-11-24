/* Roda: node --test src/lib/parceiros/bloco-parceiro-e301.test.ts — bloco parceiro do Muse (31/10): E301–E305. */
/*
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): o cartão dos gestores leva a "Ver as taxas" (/precos#carteiras), não mais a
  "Ver o Plano Gestor" (/precos#plano-gestor); a seção de /precos é "Carteiras e administradoras", com a linha única das carteiras e
  sem diferenciais; não existe mais faixa do Gestor na regra (a faixa sem teto começa em 16, a 6%) — o 20 é só o mínimo das carteiras.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { caminhoIndicacao, ufUnicaDaCidade } from "./indicacao.ts";
import { categoriaValida } from "./regras.ts";
import { CARTEIRAS_MINIMO_IMOVEIS } from "../../config/planos.ts";
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

test("E302/078: 'Ver as taxas' leva à âncora das carteiras em Preços, e ela existe (o 'Ver o Plano Gestor' saiu)", () => {
  // E896 (asserção alterada): o link mora em linksDoCartaoGestores (src/lib/parceiros/tipos-parceria.ts), com a chave de preços.
  assert.match(PARCEIROS, /linksDoCartaoGestores\(PRECOS_VISIVEL\)/);
  const tipos = readFileSync(new URL("./tipos-parceria.ts", import.meta.url), "utf8");
  // 078 (Daniel, 16/11/2026): antes /{ href: "/precos#plano-gestor", rotulo: "Ver o Plano Gestor" }/.
  assert.match(tipos, /\[\{ href: precosVisivel \? "\/precos#carteiras" : "\/para-proprietarios#taxa", rotulo: ROTULO_VER_TAXAS \}\]/);
  assert.match(tipos, /export const ROTULO_VER_TAXAS = "Ver as taxas";/);
  assert.doesNotMatch(tipos, /precos#plano-gestor|rotulo: "[^"]*Plano Gestor/);
  // 078 (Daniel, 16/11/2026): antes /id="plano-gestor"/ — a âncora de destino é a seção das carteiras, e a antiga não existe.
  assert.match(PRECOS, /id="carteiras"/);
  assert.doesNotMatch(PRECOS, /id="plano-gestor"/);
  // 078 (Daniel, 16/11/2026): antes o título da seção era <h3 …>Plano Gestor</h3>.
  assert.match(PRECOS, /<h3 className="font-semibold text-ink">Carteiras e administradoras<\/h3>/);
  assert.doesNotMatch(PRECOS, />\s*Plano Gestor\s*</);
});

test("E303/E564/078: carteira é 20+ (ou administradora), sem faixa própria — a faixa sem teto é 16+ (6%); a faixa negociável saiu da regra", () => {
  // 078 (Daniel, 16/11/2026): antes GESTOR_PRECO.minimoImoveis === 20; o 20 que ficou é o mínimo das carteiras ("fale com a Viva").
  assert.equal(CARTEIRAS_MINIMO_IMOVEIS, 20);
  assert.equal(FAIXAS_COMISSAO_PADRAO.find((f) => f.negociavel), undefined);
  // 078 (Daniel, 16/11/2026): antes a faixa marcada `gestor` começava em 20 (4%). Não há faixa do Gestor nem degrau em 20: a faixa
  // sem teto é a de 16 ou mais, a 6%.
  assert.equal(FAIXAS_COMISSAO_PADRAO.find((f) => "gestor" in f), undefined);
  assert.equal(FAIXAS_COMISSAO_PADRAO.find((f) => f.minImoveis === CARTEIRAS_MINIMO_IMOVEIS), undefined);
  assert.deepEqual(FAIXAS_COMISSAO_PADRAO.filter((f) => f.maxImoveis === null), [{ minImoveis: 16, maxImoveis: null, taxa: 0.06 }]);
  // 078 (Daniel, 16/11/2026): antes a seção de /precos (id="plano-gestor") tinha o texto único do Gestor e os 4 diferenciais; agora
  // (id="carteiras") tem só a linha das carteiras, sem lista; /parceiros traz a mesma linha.
  assert.ok(PRECOS.indexOf('id="carteiras"') > 0);
  const secao = PRECOS.slice(PRECOS.indexOf('id="carteiras"'), PRECOS.indexOf('data-testid="precos-botoes"'));
  assert.match(secao, /data-testid="carteiras-texto">\{TEXTO_CARTEIRAS\}<\/p>/);
  assert.doesNotMatch(secao, /GESTOR_TEXTO|GESTOR_DIFERENCIAIS|<ul|<li/);
  assert.doesNotMatch(secao, /condições negociadas|ROTULO_FAIXA_NEGOCIAVEL|É outra regra/);
  // 078 (Daniel, 16/11/2026): antes /Plano Gestor: ${GESTOR_TEXTO}/ no cartão de /parceiros.
  assert.match(PARCEIROS, /texto: `Taxa menor por volume\. \$\{TEXTO_CARTEIRAS\}`/);
  assert.doesNotMatch(PARCEIROS, /Plano Gestor|GESTOR_TEXTO/);
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
  assert.match(vazia, /<AvisoFotografo\s+cidade=\{cidade\}\s+uf=\{ufEfetiva\}/);
  assert.match(vazia, /<IndicarProfissional categoria=\{categoria\} \/>/);
  assert.doesNotMatch(vazia, /Abrir a página de parceiros/);
});

test("E305: a faixa 'É avaliador de imóveis?' tem foto", () => {
  const faixa = PARCEIROS.slice(PARCEIROS.indexOf('data-testid="parceiros-avaliador"'), PARCEIROS.indexOf("Ser avaliador credenciado"));
  assert.match(faixa, /data-testid="parceiros-avaliador-foto"[\s\S]*?<BrandImage src="\/images\/[^"]+" alt="[^"]{10,}"/);
});

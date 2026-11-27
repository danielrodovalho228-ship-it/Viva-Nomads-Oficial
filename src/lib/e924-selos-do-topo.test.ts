/* Roda: node --test src/lib/e924-selos-do-topo.test.ts
   E924 (Phoenix, A-253): os selos do topo da página do imóvel variam de página para página sem padrão aparente (ube-001 mostra
   "Preço justo"; ube-002/003/004/014 não).
   Levantamento por anúncio (docs/familia-3-cartao-pagina.md): cada diferença entre as páginas dos exemplos é justificada pelo dado
   do anúncio ("Preço justo" só no ube-001, o único com o valor do Airbnb declarado; "Perto de Hospital" é destaque de proximidade).
   O que não tinha justificativa: os MESMOS dados davam exibição diferente no cartão e no topo da página — o cartão abre com a pílula
   do nível e o topo da página não tinha o nível (só os outros selos, quando havia; sem eles, nenhuma fileira).
   Regra de apresentação aprovada (E626): nível em pílula própria, com a palavra; os outros selos juntos, na ordem verificado, preço
   justo, pets, negociação. Uma função só (selosDaFoto) compõe o cartão e o topo da página. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "./properties.ts";
import { ORDEM_SIMBOLOS, selosDaFoto } from "./cartao-selos-foto.ts";
import { NIVEIS } from "../config/niveis.ts";
import { exibicaoDoExemplo } from "./niveis/nivel-exemplo.ts";

const ler = (p: string) => readFileSync(p, "utf8");
type Dados = Parameters<typeof selosDaFoto>[0];
const chave = (d: Dados) => JSON.stringify([d.nivel && d.nivel !== "em_adequacao" ? d.nivel : null, !!d.verificado, !!d.precoJusto, !!d.pets, !!d.negocia]);

test("E924: mesmos dados de selos ⇒ mesma composição e mesma ordem no topo (todas as combinações)", async () => {
  const { composicaoDosSelos } = await import("./cartao-selos-foto.ts");
  const niveis: Dados["nivel"][] = [null, undefined, "em_adequacao", ...NIVEIS];
  const porChave = new Map<string, string>();
  let combinacoes = 0;
  for (const nivel of niveis) for (const verificado of [false, true]) for (const precoJusto of [false, true]) for (const pets of [false, true]) for (const negocia of [false, true]) {
    const d: Dados = { nivel, verificado, precoJusto, pets, negocia };
    const c = composicaoDosSelos(selosDaFoto(d));
    // A ordem é sempre: nível (quando há) → verificado → preço justo → pets → negociação.
    const esperado = [...(nivel && nivel !== "em_adequacao" ? [`nivel:${nivel}`] : []), ...ORDEM_SIMBOLOS.filter((s) => d[s])];
    assert.deepEqual(c, esperado, chave(d));
    // Mesmos dados (inclusive por outro caminho, com as chaves em outra ordem) ⇒ mesma composição.
    assert.deepEqual(composicaoDosSelos(selosDaFoto({ negocia, pets, precoJusto, verificado, nivel })), c);
    const antes = porChave.get(chave(d));
    if (antes !== undefined) assert.equal(JSON.stringify(c), antes, `mesma chave, mesma composição: ${chave(d)}`);
    porChave.set(chave(d), JSON.stringify(c));
    combinacoes++;
  }
  assert.equal(combinacoes, niveis.length * 16);
  assert.deepEqual([...ORDEM_SIMBOLOS], ["verificado", "precoJusto", "pets", "negocia"]);
});

test("E924: nos 15 exemplos, o topo da página e o cartão dão a mesma composição; a diferença entre anúncios é do dado", async () => {
  const { composicaoDosSelos } = await import("./cartao-selos-foto.ts");
  const doCartao = (p: (typeof SAMPLE_PROPERTIES)[number]) => composicaoDosSelos(selosDaFoto({ verificado: false, precoJusto: !!p.precoJusto, pets: !!p.petsAllowed, nivel: p.nivel, nivelVistoriado: p.nivelVistoriado, negocia: !!p.negociacao?.aceita }));
  // A página tira o nível da MESMA fonte do bloco "Nível" dela (exibicao59), que no exemplo vem do próprio anúncio.
  const daPagina = (p: (typeof SAMPLE_PROPERTIES)[number]) => composicaoDosSelos(selosDaFoto({ verificado: false, precoJusto: !!p.precoJusto, pets: !!p.petsAllowed, negocia: !!p.negociacao?.aceita, nivel: exibicaoDoExemplo(p).nivel?.nivel ?? null }));
  const porDados = new Map<string, string>();
  for (const p of SAMPLE_PROPERTIES) {
    assert.deepEqual(daPagina(p), doCartao(p), `${p.id}: topo da página = cartão`);
    assert.match(daPagina(p)[0] ?? "", /^nivel:/, `${p.id}: o topo abre com a pílula do nível`);
    const k = JSON.stringify([p.nivel, !!p.precoJusto, !!p.petsAllowed, !!p.negociacao?.aceita]);
    const c = JSON.stringify(daPagina(p));
    if (porDados.has(k)) assert.equal(c, porDados.get(k), `${p.id}: mesmos dados, mesma composição`);
    porDados.set(k, c);
  }
  // Levantamento: "Preço justo" só onde o dado sustenta (total do mês ≤ valor declarado do Airbnb) — hoje, só o ube-001.
  assert.deepEqual(SAMPLE_PROPERTIES.filter((p) => p.precoJusto).map((p) => p.id), ["ube-001"]);
  assert.deepEqual(SAMPLE_PROPERTIES.filter((p) => p.airbnbMonthlyPrice != null).map((p) => p.id), ["ube-001"]);
  assert.deepEqual(daPagina(SAMPLE_PROPERTIES.find((p) => p.id === "ube-001")!), ["nivel:essencial", "precoJusto", "pets"]);
  assert.deepEqual(daPagina(SAMPLE_PROPERTIES.find((p) => p.id === "ube-002")!), ["nivel:essencial", "pets"]);
  for (const id of ["ube-003", "ube-004", "ube-014"]) assert.deepEqual(daPagina(SAMPLE_PROPERTIES.find((p) => p.id === id)!), ["nivel:essencial"], id);
});

test("E924 (estático): o topo da página e o cartão compõem os selos pela mesma função e desenham na ordem dela", () => {
  const pagina = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  const cartao = ler("src/components/property-card.tsx");
  const lista = ler("src/components/property/selos-anuncio.tsx");
  assert.match(cartao, /selosDaFoto\(\{/);
  assert.match(pagina, /<SelosAnuncio\s+selos=\{selosDaFoto\(\{/);
  assert.match(pagina, /nivel: exibicao59\?\.nivel\?\.nivel/, "o nível do topo é o do bloco Nível da própria página");
  assert.doesNotMatch(pagina, /<SelosAnuncio tem=/);
  // A pílula do nível vem primeiro, com a palavra; os outros selos vêm depois, na ordem que a função devolve.
  const iNivel = lista.indexOf('data-testid="selo-nivel"');
  const iSimbolos = lista.indexOf("selos.simbolos.map(");
  assert.ok(iNivel > 0 && iSimbolos > iNivel, "nível antes dos outros selos");
  assert.match(lista, /\{selos\.nivel\.rotulo\}/);
  assert.match(lista, /COR_NIVEL\[selos\.nivel\.id\]/, "a mesma cor da pílula do cartão");
  assert.doesNotMatch(lista, /ORDEM_SIMBOLOS\.filter/, "a lista não reordena por conta própria");
});

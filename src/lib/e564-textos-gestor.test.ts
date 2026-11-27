// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
/**
 * E564 (parte A, decisão do Daniel, 04/11/2026) — textos do Plano Gestor nas TELAS, sobre a regra da parte B (#2519:
 * 1–2 12% · 3–5 10% · 6–15 8% · 16–19 6% · 20+ = Plano Gestor 4%, sem assinatura). Entra "Gestor: 4% para carteiras de
 * 20 ou mais imóveis, com cadastro assistido da carteira e contato direto na Viva"; sai "condições negociadas", "taxa
 * negociável", "taxa zero" e a assinatura; nada da fase 2 é anunciado. `npm test`.
 *
 * Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): o Plano Gestor de 4% deixou de ser oferta pública. O texto único do
 * Gestor (GESTOR_TEXTO), a constante GESTOR_PRECO e os diferenciais (GESTOR_DIFERENCIAIS) saíram; no lugar, a linha única das
 * carteiras (TEXTO_CARTEIRAS, sem taxa). As telas citam essa linha (ou a frase da escada) e não citam mais o Plano Gestor; a
 * seção de /precos virou #carteiras, sem lista de diferenciais; /anunciar não filtra mais a faixa do Gestor; a apresentação
 * estática termina em "16–19 imóveis — 6%" + a linha das carteiras. O que continua igual: nada de "negociável",
 * "condições negociadas", "taxa zero" nem fase 2.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as planos from "../config/planos.ts";
import { CARTEIRAS_MINIMO_IMOVEIS, PLANOS, TEXTO_CARTEIRAS } from "../config/planos.ts";
import { fonteSemComentarios as semComentarios } from "./fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("078: a linha única das carteiras sai da constante (20+, sem taxa); o texto único do Gestor (4%) saiu", () => {
  // 078 (Daniel, 16/11/2026): antes GESTOR_PRECO.taxa === 0.04 — a constante saiu; o que sobrou do "20" é o mínimo das carteiras.
  assert.equal("GESTOR_PRECO" in planos, false);
  assert.equal(CARTEIRAS_MINIMO_IMOVEIS, 20);
  // 078 (Daniel, 16/11/2026): antes GESTOR_TEXTO === "4% para carteiras de 20 ou mais imóveis ou conta de administradora, com cadastro
  // assistido da carteira e contato direto na Viva". O texto único agora é a linha das carteiras, sem taxa e sem promessa.
  assert.equal("GESTOR_TEXTO" in planos, false);
  assert.equal(TEXTO_CARTEIRAS, "Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva.");
  assert.doesNotMatch(TEXTO_CARTEIRAS, /%|cadastro assistido|contato direto/i);
});

test("078: nenhum diferencial de Gestor é anunciado (o plano ficou só como histórico) — nada da fase 2", () => {
  // 078 (Daniel, 16/11/2026): antes GESTOR_DIFERENCIAIS = ["Taxa de serviço de 4% sobre o valor total de cada contrato", "Cadastro
  // assistido da carteira", "Contato direto na Viva", "Suporte prioritário"]; a lista saiu de config/planos.
  assert.equal("GESTOR_DIFERENCIAIS" in planos, false);
  const g = PLANOS.find((p) => p.id === "gestor")!;
  // 078 (Daniel, 16/11/2026): antes g.beneficios eram os 4 diferenciais; o plano histórico não anuncia benefício, taxa nem venda.
  assert.deepEqual(g.beneficios, []);
  assert.equal(g.custoLabel, "Condições combinadas com a Viva");
  assert.equal(g.cta, "Falar com a Viva");
  assert.equal(g.comissao, 0.04, "só para ler contratos antigos (taxaDoContrato)");
  assert.doesNotMatch(semComentarios(ler("config/planos.ts")), /Taxa de serviço de 4%|Cadastro assistido|Contato direto na Viva|Suporte prioritário/);
  for (const fase2 of [/ilimitad/i, /recursos de carteira/i, /em construção/i, /vários proprietários/i, /permiss/i, /importa/i, /sincroniza/i])
    assert.ok(!g.beneficios.some((b) => fase2.test(b)), String(fase2));
  assert.doesNotMatch(ler("config/planos.ts"), /Taxa de serviço zero/);
});

// 078 (Daniel, 16/11/2026): antes toda tela citava o Gestor por /GESTOR_TEXTO|FRASE_ESCADA_TAXAS/. Agora cada uma cita a linha das
// carteiras pela fonte única — o padrão exato de cada arquivo (o formulário usa o mínimo CARTEIRAS_MINIMO_IMOVEIS na própria frase).
const TELAS: [string, RegExp][] = [
  ["app/(public)/para-proprietarios/page.tsx", /\{FRASE_ESCADA_TAXAS\}/],
  ["app/(public)/precos/page.tsx", /data-testid="carteiras-texto">\{TEXTO_CARTEIRAS\}<\/p>/],
  ["app/(public)/parceiros/page.tsx", /texto: `Taxa menor por volume\. \$\{TEXTO_CARTEIRAS\}`/],
  ["components/precos/plano-gestor-form.tsx", /Para carteira a partir de \{CARTEIRAS_MINIMO_IMOVEIS\} imóveis ou administradora de imóveis\. Conte sobre a sua carteira e o time da Viva fala com você\./],
  ["components/modelo-negocio/modelo-negocio.tsx", /Imóvel ativo = publicado e aprovado\. \{TEXTO_CARTEIRAS\}/],
];
const ANTIGOS = [/condições negociadas/, /ROTULO_FAIXA_NEGOCIAVEL/, /TAXA_NEGOCIADA_TEXTO/, /Negociável, entre em contato/, /taxa negociável/i, /negociavel/, /fase 2 \(futuro\)/];

for (const [f, carteiras] of TELAS) {
  test(`${f}: a linha das carteiras pela fonte única, sem o Plano Gestor; nada de 'negociável' nem 'condições negociadas'`, () => {
    const src = ler(f);
    // E805/078: /para-proprietarios cita as carteiras dentro da frase única da escada (FRASE_ESCADA_TAXAS, que usa TEXTO_CARTEIRAS).
    assert.match(src, carteiras);
    // 078 (Daniel, 16/11/2026): antes a tela TINHA o texto do Gestor (GESTOR_TEXTO); agora nenhum texto de tela cita o Plano Gestor,
    // os diferenciais nem uma taxa de 4% (comentários de fora).
    assert.doesNotMatch(semComentarios(src), /GESTOR_TEXTO|GESTOR_DIFERENCIAIS|GESTOR_PRECO|Plano Gestor|(?<![\d,.])4\s?%/);
    for (const r of ANTIGOS) assert.doesNotMatch(src, r, String(r));
  });
}

test("/precos: a seção das carteiras tem só o título e a linha única — sem taxa nem lista de diferenciais", () => {
  const p = ler("app/(public)/precos/page.tsx");
  // 078 (Daniel, 16/11/2026): antes a seção era id="plano-gestor"; virou id="carteiras" e a âncora antiga não existe.
  assert.equal(p.indexOf('id="plano-gestor"'), -1);
  assert.ok(p.indexOf('id="carteiras"') > 0 && p.indexOf('id="carteiras"') < p.indexOf('data-testid="precos-botoes"'));
  const secao = p.slice(p.indexOf('id="carteiras"'), p.indexOf('data-testid="precos-botoes"'));
  // 078 (Daniel, 16/11/2026): antes data-testid="plano-gestor-texto">{GESTOR_TEXTO}.</p>
  assert.match(secao, /<h3[^>]*>Carteiras e administradoras<\/h3>\s*<p[^>]*data-testid="carteiras-texto">\{TEXTO_CARTEIRAS\}<\/p>/);
  // 078 (Daniel, 16/11/2026): antes a seção TINHA os 4 diferenciais (GESTOR_DIFERENCIAIS.map); agora não tem lista, taxa nem plano.
  assert.doesNotMatch(secao, /GESTOR_DIFERENCIAIS|<ul|<li|\d ?%|Plano Gestor|plano-gestor-(secao|texto|diferenciais)/);
});

test("/anunciar: a escada inteira e a linha das carteiras (sem faixa do Gestor para separar, sem a faixa negociável)", () => {
  const p = ler("app/(public)/para-proprietarios/page.tsx");
  // 078 (Daniel, 16/11/2026): antes /const FAIXAS_PUBLICAS = FAIXAS_COMISSAO_PADRAO.filter((f) => !f.gestor);/ — não há mais faixa do
  // Gestor para tirar da lista: a maior taxa vem pronta da regra (TAXA_MAIOR_TEXTO) e a página não filtra faixa nenhuma.
  assert.match(p, /import \{ TAXA_MAIOR_TEXTO \} from "@\/lib\/cobranca\/regra";/);
  assert.match(p, /const TAXA_MAIOR = TAXA_MAIOR_TEXTO;/);
  assert.doesNotMatch(p, /FAIXAS_PUBLICAS|f\.gestor|FAIXAS_COMISSAO_PADRAO/);
  // E805/078: a escada inteira (12/10/8/6) + a linha das carteiras pela frase única FRASE_ESCADA_TAXAS.
  assert.match(p, /\{FRASE_ESCADA_TAXAS\}/);
});

test("a apresentação estática segue a tabela nova (sem 31+ negociável)", () => {
  const html = readFileSync(new URL("../../public/apresentacao.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /taxa negociável|negociado · 6%|16–30 imóveis/);
  // 078 (Daniel, 16/11/2026): antes <span>16–19 imóveis</span><b>6%</b> — com o 078 passou a "16 ou mais" e, pela ORDEM-DUET-534, voltou a "16–19".
  assert.match(html, /<span>16–19 imóveis<\/span><b>6%<\/b>/);
  // ORDEM-DUET-534: a negação inverteu — a apresentação diz "16–19 imóveis" e não promete "16 ou mais".
  assert.doesNotMatch(html, /16 ou mais imóveis/);
  // 078 (Daniel, 16/11/2026): antes a apresentação TINHA a linha <span>Plano Gestor</span><b>4%</b>; no lugar, a linha das carteiras,
  // sem taxa — e nem o plano nem os 4% aparecem.
  assert.match(html, /<span>Carteira a partir de 20 imóveis ou administradora de imóveis<\/span><b>Fale com a Viva<\/b>/);
  assert.doesNotMatch(html, /Plano Gestor|<b>4%<\/b>/);
});

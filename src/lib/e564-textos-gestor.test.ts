/**
 * E564 (parte A, decisão do Daniel, 04/11/2026) — textos do Plano Gestor nas TELAS, sobre a regra da parte B (#2519:
 * 1–2 12% · 3–5 10% · 6–15 8% · 16–19 6% · 20+ = Plano Gestor 4%, sem assinatura). Entra "Gestor: 4% para carteiras de
 * 20 ou mais imóveis, com cadastro assistido da carteira e contato direto na Viva"; sai "condições negociadas", "taxa
 * negociável", "taxa zero" e a assinatura; nada da fase 2 é anunciado. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GESTOR_DIFERENCIAIS, GESTOR_PRECO, GESTOR_TEXTO, PLANOS } from "../config/planos.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("o texto único do Gestor sai da constante da parte B (4%, 20+)", () => {
  assert.equal(GESTOR_PRECO.taxa, 0.04);
  // E905 (asserção alterada): com a alternativa aprovada "ou conta de administradora" (antes, só "carteiras de 20 ou mais imóveis").
  assert.equal(GESTOR_TEXTO, "4% para carteiras de 20 ou mais imóveis ou conta de administradora, com cadastro assistido da carteira e contato direto na Viva");
});

test("só os diferenciais do lançamento — nada da fase 2", () => {
  assert.deepEqual([...GESTOR_DIFERENCIAIS], ["Taxa de serviço de 4% sobre o valor total de cada contrato", "Cadastro assistido da carteira", "Contato direto na Viva", "Suporte prioritário"]);
  const g = PLANOS.find((p) => p.id === "gestor")!;
  assert.deepEqual(g.beneficios, [...GESTOR_DIFERENCIAIS]);
  for (const fase2 of [/ilimitad/i, /recursos de carteira/i, /em construção/i, /vários proprietários/i, /permiss/i, /importa/i, /sincroniza/i])
    assert.ok(!g.beneficios.some((b) => fase2.test(b)), String(fase2));
  assert.doesNotMatch(ler("config/planos.ts"), /Taxa de serviço zero/);
});

const TELAS = [
  "app/(public)/para-proprietarios/page.tsx",
  "app/(public)/precos/page.tsx",
  "app/(public)/parceiros/page.tsx",
  "components/precos/plano-gestor-form.tsx",
  "components/modelo-negocio/modelo-negocio.tsx",
];
const ANTIGOS = [/condições negociadas/, /ROTULO_FAIXA_NEGOCIAVEL/, /TAXA_NEGOCIADA_TEXTO/, /Negociável, entre em contato/, /taxa negociável/i, /negociavel/, /fase 2 \(futuro\)/];

for (const f of TELAS) {
  test(`${f}: o Gestor pelo texto único; nada de 'negociável' nem 'condições negociadas'`, () => {
    const src = ler(f);
    // E805: /para-proprietarios cita o Gestor dentro da frase única da escada (FRASE_ESCADA_TAXAS, que usa GESTOR_TEXTO).
    assert.match(src, /GESTOR_TEXTO|FRASE_ESCADA_TAXAS/);
    for (const r of ANTIGOS) assert.doesNotMatch(src, r, String(r));
  });
}

test("/precos: a seção do Gestor tem o texto e os 4 diferenciais", () => {
  const p = ler("app/(public)/precos/page.tsx");
  const secao = p.slice(p.indexOf('id="plano-gestor"'), p.indexOf('data-testid="precos-botoes"'));
  assert.match(secao, /data-testid="plano-gestor-texto">\{GESTOR_TEXTO\}\.<\/p>/);
  assert.match(secao, /GESTOR_DIFERENCIAIS\.map/);
});

test("/anunciar: a tabela inteira e o Gestor à parte (sem a faixa negociável)", () => {
  const p = ler("app/(public)/para-proprietarios/page.tsx");
  assert.match(p, /const FAIXAS_PUBLICAS = FAIXAS_COMISSAO_PADRAO\.filter\(\(f\) => !f\.gestor\);/);
  // E805: a escada inteira (12/10/8/6) + "Plano Gestor: {GESTOR_TEXTO}" pela frase única FRASE_ESCADA_TAXAS.
  assert.match(p, /\{FRASE_ESCADA_TAXAS\}/);
});

test("a apresentação estática segue a tabela nova (sem 31+ negociável)", () => {
  const html = readFileSync(new URL("../../public/apresentacao.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /taxa negociável|negociado · 6%|16–30 imóveis/);
  assert.match(html, /<span>16–19 imóveis<\/span><b>6%<\/b>/);
  // HTML estático não lê a constante: o Gestor vai sem número escrito à mão (varredura do E236).
  assert.match(html, /<span>Plano Gestor<\/span><b>4%<\/b>/);
});

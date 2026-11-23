// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
/*
  E805 — a escada inteira da taxa (12/10/8/6) e o Plano Gestor (4%) onde a taxa é apresentada, igual em
  /para-proprietarios e /como-funciona, pela fonte única; a cobrança na renovação não vira promessa pública.
  Roda: node --test src/lib/e805-escada-taxas.test.ts
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): a escada termina em "16–19 imóveis: 6%" (antes "16–19 imóveis: 6%",
  com a faixa do Gestor fora do texto); a frase única traz a linha das carteiras (TEXTO_CARTEIRAS) no lugar de "Plano Gestor: 4%
  para…", e não cita plano nem taxa abaixo da escada.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { escadaTaxasTexto, FAIXAS_COMISSAO_PADRAO } from "./cobranca/regra.ts";
import { FRASE_ESCADA_TAXAS } from "../config/textos-regulados.ts";
import { TEXTO_CARTEIRAS } from "../config/planos.ts";
import { achadosProibidos } from "./frases-proibidas.ts";

const ler = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const CF = "app/(public)/como-funciona/page.tsx";
const PP = "app/(public)/para-proprietarios/page.tsx";

test("a escada sai da regra: 1–2 = 12%, 3–5 = 10%, 6–15 = 8%, 16–19 = 6% (078: a escada inteira, sem faixa do Gestor)", () => {
  // 078 (Daniel, 16/11/2026): antes "… · 16–19 imóveis: 6%" (a quinta faixa, do Gestor, ficava de fora do texto); agora a escada
  // tem 4 faixas e o texto traz todas — a última, sem teto, por extenso.
  assert.equal(escadaTaxasTexto(), "1–2 imóveis: 12% · 3–5 imóveis: 10% · 6–15 imóveis: 8% · 16–19 imóveis: 6%");
  assert.equal(escadaTaxasTexto().split(" · ").length, FAIXAS_COMISSAO_PADRAO.length);
  // Muda a regra, muda o texto: nada digitado à mão.
  const outra = FAIXAS_COMISSAO_PADRAO.map((f) => (f.minImoveis === 1 ? { ...f, taxa: 0.11 } : f));
  assert.match(escadaTaxasTexto(outra), /^1–2 imóveis: 11% ·/);
});

test("a frase única tem a escada inteira e a linha das carteiras (078: sem o Plano Gestor e sem 4%)", () => {
  // 078 (Daniel, 16/11/2026): antes os pedaços eram "16–19 imóveis: 6%" e `Plano Gestor: ${GESTOR_TEXTO}`.
  for (const pedaco of ["1–2 imóveis: 12%", "3–5 imóveis: 10%", "6–15 imóveis: 8%", "16–19 imóveis: 6%", TEXTO_CARTEIRAS]) {
    assert.ok(FRASE_ESCADA_TAXAS.includes(pedaco), pedaco);
  }
  assert.equal(
    FRASE_ESCADA_TAXAS,
    "Quanto mais imóveis ativos, menor a taxa: 1–2 imóveis: 12% · 3–5 imóveis: 10% · 6–15 imóveis: 8% · 16–19 imóveis: 6%. Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva.",
  );
  // 078 (Daniel, 16/11/2026): antes /^4%/ no texto do Gestor (a frase TINHA os 4%); agora a frase não cita o plano nem taxa
  // abaixo da escada, e a linha das carteiras não tem percentual nenhum.
  assert.doesNotMatch(FRASE_ESCADA_TAXAS, /Plano Gestor|(?<![\d,.])4\s?%/);
  assert.doesNotMatch(TEXTO_CARTEIRAS, /%/);
  assert.deepEqual(achadosProibidos(FRASE_ESCADA_TAXAS), []);
});

test("as duas páginas apresentam a taxa pela MESMA frase única", () => {
  for (const arq of [PP, CF]) {
    const p = ler(arq);
    assert.match(p, /import \{[^}]*FRASE_ESCADA_TAXAS[^}]*\} from "@\/config\/textos-regulados";/, arq);
    assert.match(p, /\{FRASE_ESCADA_TAXAS\}/, arq);
    // Fora do CSS (posição de foto "78% 30%"), nenhum percentual escrito à mão.
    assert.doesNotMatch(p.replace(/posicaoFoto="[^"]*"/g, ""), /\d+ ?%/, `${arq}: nenhum percentual escrito à mão`);
  }
  assert.match(ler(PP), /data-testid="anunciar-taxa"[\s\S]{0,400}\{FRASE_ESCADA_TAXAS\}/);
  assert.match(ler(CF), /data-testid="cf-taxa-proprietario"[\s\S]{0,400}\{FRASE_ESCADA_TAXAS\}/);
  // A faixa resumida "de 12% a 6%" saiu: a escada inteira está no lugar.
  assert.doesNotMatch(ler(PP), /TAXA_MENOR/);
});

test("a cobrança na renovação não é promessa pública nessas páginas (aguarda o parecer jurídico)", () => {
  for (const arq of [PP, CF]) {
    assert.deepEqual(achadosProibidos(ler(arq), `src/${arq}`).filter((a) => a.id === "taxa-na-renovacao-em-pagina-publica"), [], arq);
  }
  assert.match(ler(CF), /A estadia se renova em blocos, com aceite das duas partes\."/);
  // A regra pega a frase antiga.
  const antiga = "A taxa do proprietário é cobrada uma vez em cada contrato e em cada renovação, sobre o valor total do período.";
  assert.ok(achadosProibidos(antiga, "src/app/(public)/como-funciona/page.tsx").some((a) => a.id === "taxa-na-renovacao-em-pagina-publica"));
  // Fora do escopo (Ajuda, contrato, termos) a regra não vale.
  assert.deepEqual(achadosProibidos(antiga, "src/lib/atendimento/faq.ts").filter((a) => a.id === "taxa-na-renovacao-em-pagina-publica"), []);
});

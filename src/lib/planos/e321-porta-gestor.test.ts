/*
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): a porta do Plano Gestor (PORTA_GESTOR_TEXTO, gestorElegivel,
  GESTOR_MIN_IMOVEIS_VALIDADOS) saiu. O que ficou é a linha única das carteiras ("a partir de 20 imóveis ou administradora de imóveis:
  fale com a Viva"), sem taxa: administradora paga a faixa dos imóveis que tem; telas e atendimento citam a linha pela fonte única.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as planos from "../../config/planos.ts";
import { CARTEIRAS_MINIMO_IMOVEIS, TEXTO_CARTEIRAS } from "../../config/planos.ts";
import * as gestor from "./gestor.ts";
import { faixaPorImoveisAtivos, taxaNaAssinatura } from "../cobranca/regra.ts";
import { mensagemAvisoParceiro } from "../fotografos/aviso.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E321/078: a porta das carteiras é uma só — a partir de N imóveis OU administradora: fale com a Viva; não abre taxa nenhuma", () => {
  // 078 (Daniel, 16/11/2026): antes PORTA_GESTOR_TEXTO === "20 imóveis ou mais ativos (…), ou conta de administradora" (a porta do Plano
  // Gestor de 4%). A porta que ficou é a linha das carteiras — as duas metades (N imóveis OU administradora), sem taxa.
  assert.equal("PORTA_GESTOR_TEXTO" in planos, false);
  assert.equal(TEXTO_CARTEIRAS, `Carteira a partir de ${CARTEIRAS_MINIMO_IMOVEIS} imóveis ou administradora de imóveis: fale com a Viva.`);
  assert.doesNotMatch(TEXTO_CARTEIRAS, /%|plano/i);
  // 078 (Daniel, 16/11/2026): antes GESTOR_MIN_IMOVEIS_VALIDADOS === 20; o 20 agora é CARTEIRAS_MINIMO_IMOVEIS.
  assert.equal("GESTOR_MIN_IMOVEIS_VALIDADOS" in gestor, false);
  assert.equal(CARTEIRAS_MINIMO_IMOVEIS, 20);
  // 078 (Daniel, 16/11/2026): antes "a mesma regra da elegibilidade" — gestorElegivel: administradora com 0 imóveis = sim; 20 imóveis =
  // sim; 19 = não. A elegibilidade saiu (não há plano para ativar): administradora paga a faixa dos imóveis que tem, e 19 e 20
  // imóveis pagam a MESMA taxa (não há degrau em 20).
  assert.equal("gestorElegivel" in gestor, false);
  const em = new Date("2026-11-16T12:00:00Z");
  const taxaDe = (imoveisAtivos: number, administradora: boolean) => taxaNaAssinatura({ tipo: "novo" as const, imoveisAtivos, assinadoEm: em, ...(administradora ? { administradora } : {}) }).taxa;
  assert.equal(taxaDe(0, true), 0.12);
  assert.equal(taxaDe(3, true), 0.1);
  assert.equal(taxaDe(3, true), taxaDe(3, false));
  assert.equal(faixaPorImoveisAtivos(20).taxa, 0.06);
  assert.equal(faixaPorImoveisAtivos(19).taxa, faixaPorImoveisAtivos(20).taxa);
});

test("E321 → E564 → 078: /para-proprietarios não mistura as regras — a escada de 12% a 6% e a linha das carteiras, pela frase única", () => {
  const p = ler("app/(public)/para-proprietarios/page.tsx");
  assert.doesNotMatch(p, /condições negociadas|ROTULO_FAIXA_NEGOCIAVEL|LIMITE_FAIXAS/);
  // E805/078: a escada inteira + a linha das carteiras, na frase única FRASE_ESCADA_TAXAS (asserções deste caso não mudaram).
  assert.match(p, /\{FRASE_ESCADA_TAXAS\}/);
});

test("E321/078: as telas e o atendimento citam as carteiras pela linha única (20+ ou administradora), sem o texto nem a porta do Gestor", () => {
  // 078 (Daniel, 16/11/2026): antes as três telas citavam o Gestor por /GESTOR_TEXTO/. Agora citam a linha das carteiras: /precos e
  // /parceiros pela constante inteira; o formulário, pela frase com o mínimo (CARTEIRAS_MINIMO_IMOVEIS) e a administradora.
  const telas: [string, RegExp][] = [
    ["app/(public)/precos/page.tsx", /data-testid="carteiras-texto">\{TEXTO_CARTEIRAS\}<\/p>/],
    ["components/precos/plano-gestor-form.tsx", /Para carteira a partir de \{CARTEIRAS_MINIMO_IMOVEIS\} imóveis ou administradora de imóveis\./],
    ["app/(public)/parceiros/page.tsx", /texto: `Taxa menor por volume\. \$\{TEXTO_CARTEIRAS\}`/],
  ];
  for (const [arq, re] of telas) {
    assert.match(ler(arq), re, arq);
    assert.doesNotMatch(ler(arq), /GESTOR_TEXTO/, arq);
  }
  // 078 (Daniel, 16/11/2026): antes o atendimento citava a porta do Gestor por /PORTA_GESTOR_TEXTO/. Agora, a escada da regra seguida
  // da linha das carteiras.
  const atendimento: [string, RegExp][] = [
    ["lib/atendimento/faq.ts", /\$\{escadaTaxasCurta\(\)\}\. \$\{TEXTO_CARTEIRAS\}/],
    ["lib/atendimento/viva-prompt.ts", /\$\{escadaTaxasCurta\(\)\}\. \$\{TEXTO_CARTEIRAS\}/],
    ["lib/atendimento/parceiros-texto.ts", /\$\{escadaTaxasCurta\(\)\}\)\. \$\{TEXTO_CARTEIRAS\}/],
  ];
  for (const [arq, re] of atendimento) {
    assert.match(ler(arq), re, arq);
    assert.doesNotMatch(ler(arq), /PORTA_GESTOR_TEXTO|Plano Gestor/, arq);
  }
  // 078 (Daniel, 16/11/2026): antes "nenhuma tela diz 'Gestor a partir de N' sem a outra metade" (/${GESTOR_PRECO.minimoImoveis}…/).
  // Agora: nenhuma tela pública diz "a partir de N imóveis" sem a outra metade (administradora).
  for (const arq of ["components/precos/plano-gestor-form.tsx", "app/(public)/parceiros/page.tsx"]) {
    assert.doesNotMatch(ler(arq), /\{CARTEIRAS_MINIMO_IMOVEIS\}(?! imóveis ou administradora de imóveis)/, arq);
    assert.doesNotMatch(ler(arq), /GESTOR_PRECO/, arq);
  }
});

test("E321 (carona): aviso sem categoria tem a frase neutra", () => {
  assert.equal(mensagemAvisoParceiro("outro", "Uberlândia", "Outro serviço"), "Anotado! Avisamos você quando houver parceiro em Uberlândia.");
  assert.equal(mensagemAvisoParceiro("limpeza", "Uberlândia", "Limpeza"), "Anotado! Avisamos você quando houver parceiro de limpeza em Uberlândia.");
});

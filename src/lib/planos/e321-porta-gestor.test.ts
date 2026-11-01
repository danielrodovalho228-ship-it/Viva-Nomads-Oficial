import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GESTOR_PRECO, PORTA_GESTOR_TEXTO } from "../../config/planos.ts";
import { GESTOR_MIN_IMOVEIS_VALIDADOS, gestorElegivel } from "./gestor.ts";
import { mensagemAvisoParceiro } from "../fotografos/aviso.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E321: a porta do Gestor é uma só — N+ imóveis com documento aprovado OU administradora", () => {
  assert.equal(PORTA_GESTOR_TEXTO, `${GESTOR_PRECO.minimoImoveis} imóveis ou mais com documento aprovado, ou conta de administradora`);
  assert.equal(GESTOR_MIN_IMOVEIS_VALIDADOS, 20);
  // A mesma regra da elegibilidade.
  assert.equal(gestorElegivel({ accountType: "gestor", imoveisValidados: 0 }), true);
  assert.equal(gestorElegivel({ accountType: "individual", imoveisValidados: 20 }), true);
  assert.equal(gestorElegivel({ accountType: "individual", imoveisValidados: 19 }), false);
});

test("E321: /para-proprietarios não mistura as regras — 31+ é taxa negociável; Gestor é a porta própria", () => {
  const p = ler("app/(public)/para-proprietarios/page.tsx");
  assert.doesNotMatch(p, /acima de \{LIMITE_FAIXAS\} imóveis, condições negociadas/);
  assert.match(p, /com \{LIMITE_FAIXAS \+ 1\} ou mais imóveis ativos, \{ROTULO_FAIXA_NEGOCIAVEL\}/);
  assert.match(p, /Plano Gestor: \{PORTA_GESTOR_TEXTO\}/);
});

test("E321: as demais telas que citam o Gestor usam a mesma porta", () => {
  for (const arq of ["app/(public)/precos/page.tsx", "components/precos/plano-gestor-form.tsx", "app/(public)/parceiros/page.tsx", "lib/atendimento/faq.ts", "lib/atendimento/viva-prompt.ts", "lib/atendimento/parceiros-texto.ts"]) {
    assert.match(ler(arq), /PORTA_GESTOR_TEXTO/, arq);
  }
  // Nenhuma tela pública diz "Gestor a partir de N" sem a outra metade (administradora).
  for (const arq of ["components/precos/plano-gestor-form.tsx", "app/(public)/parceiros/page.tsx"]) {
    assert.doesNotMatch(ler(arq), /\$\{GESTOR_PRECO\.minimoImoveis\}( imóveis)? (ou mais|imóveis)/, arq);
  }
});

test("E321 (carona): aviso sem categoria tem a frase neutra", () => {
  assert.equal(mensagemAvisoParceiro("outro", "Uberlândia", "Outro serviço"), "Anotado! Avisamos você quando houver parceiro em Uberlândia.");
  assert.equal(mensagemAvisoParceiro("limpeza", "Uberlândia", "Limpeza"), "Anotado! Avisamos você quando houver parceiro de limpeza em Uberlândia.");
});

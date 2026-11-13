import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GESTOR_PRECO, PORTA_GESTOR_TEXTO } from "../../config/planos.ts";
import { GESTOR_MIN_IMOVEIS_VALIDADOS, gestorElegivel } from "./gestor.ts";
import { mensagemAvisoParceiro } from "../fotografos/aviso.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E321/E564: a porta do Gestor é uma só — N+ imóveis ativos de verdade OU administradora", () => {
  assert.equal(PORTA_GESTOR_TEXTO, `${GESTOR_PRECO.minimoImoveis} imóveis ou mais ativos (publicados, com documento aprovado e calendário em dia), ou conta de administradora`);
  assert.equal(GESTOR_MIN_IMOVEIS_VALIDADOS, 20);
  // A mesma regra da elegibilidade.
  assert.equal(gestorElegivel({ accountType: "gestor", imoveisValidados: 0 }), true);
  assert.equal(gestorElegivel({ accountType: "individual", imoveisValidados: 20 }), true);
  assert.equal(gestorElegivel({ accountType: "individual", imoveisValidados: 19 }), false);
});

test("E321 → E564: /para-proprietarios não mistura as regras — a tabela de 12% a 6%; o Gestor (4%) é o texto próprio", () => {
  const p = ler("app/(public)/para-proprietarios/page.tsx");
  assert.doesNotMatch(p, /condições negociadas|ROTULO_FAIXA_NEGOCIAVEL|LIMITE_FAIXAS/);
  // E805: a escada inteira + o Gestor pelo texto próprio, na frase única FRASE_ESCADA_TAXAS.
  assert.match(p, /\{FRASE_ESCADA_TAXAS\}/);
});

test("E321/E564: as telas citam o Gestor pelo texto único; o atendimento, pela porta inteira (20+ ou administradora)", () => {
  for (const arq of ["app/(public)/precos/page.tsx", "components/precos/plano-gestor-form.tsx", "app/(public)/parceiros/page.tsx"]) {
    assert.match(ler(arq), /GESTOR_TEXTO/, arq);
  }
  for (const arq of ["lib/atendimento/faq.ts", "lib/atendimento/viva-prompt.ts", "lib/atendimento/parceiros-texto.ts"]) {
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

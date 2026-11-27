import { test } from "node:test";
import assert from "node:assert/strict";
import { PRAZO_CANAL, TEXTO_PRAZO_EMPRESAS, TEXTO_PRAZO_PARCERIA } from "../../config/prazos-canais.ts";
import { DIAS_RESPOSTA_PARCERIA, PRAZO_RESPOSTA_PARCERIA } from "../parceiros/regras.ts";
import { PROMESSA_HUMANA_H } from "../../config/atendimento.ts";
import { fonte, PRAZO_A_MAO } from "./ler.ts";

/*
  E835 (guarda-chuva da Família 1, 14/11): as promessas de prazo de resposta divergiam entre as superfícies públicas.
  Regra: UM prazo por canal, escrito uma vez em src/config/prazos-canais.ts; toda superfície pública que fala desse prazo
  usa a constante — nenhum número de prazo escrito à mão numa frase de resposta.
*/
test("um prazo por canal: parceiro 7 dias, empresas 7 dias, suporte 24 h (as superfícies principais de hoje)", () => {
  assert.deepEqual(
    { parceiro: PRAZO_CANAL.parceiro.texto, empresas: PRAZO_CANAL.empresas.texto, suporte: PRAZO_CANAL.suporte.texto },
    { parceiro: "7 dias", empresas: "7 dias", suporte: "24 h" }
  );
  assert.equal(DIAS_RESPOSTA_PARCERIA, PRAZO_CANAL.parceiro.dias, "parceiros/regras lê a fonte única");
  assert.equal(PRAZO_RESPOSTA_PARCERIA, PRAZO_CANAL.parceiro.texto);
  assert.equal(PROMESSA_HUMANA_H, PRAZO_CANAL.suporte.horas, "o atendimento e a fonte dos canais dizem o mesmo");
  assert.match(TEXTO_PRAZO_PARCERIA, /em até 7 dias/);
  assert.match(TEXTO_PRAZO_EMPRESAS, /em até 7 dias/);
});

const SUPERFICIES = [
  "src/app/(public)/empresas/page.tsx",
  "src/app/(public)/empresas/empresas-form.tsx",
  "src/app/(public)/parceiros/page.tsx",
  "src/app/(public)/como-funciona/page.tsx",
  "src/app/(public)/ajuda/page.tsx",
  "src/app/(public)/ajuda/fale-com-a-viva/page.tsx",
  "src/components/parceiros/seja-parceiro-form.tsx",
  "src/components/ajuda/central-ajuda.tsx",
  "src/components/ajuda/falar-com-a-viva.tsx",
  "src/lib/atendimento/faq.ts",
  "src/lib/atendimento/parceiros-texto.ts",
];

test("nenhuma superfície pública da família escreve um prazo de resposta à mão (varredura)", () => {
  for (const s of SUPERFICIES) {
    const linhas = fonte(s).split("\n").filter((l) => PRAZO_A_MAO.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
    assert.deepEqual(linhas, [], `${s}: prazo escrito à mão — use src/config/prazos-canais.ts`);
  }
});

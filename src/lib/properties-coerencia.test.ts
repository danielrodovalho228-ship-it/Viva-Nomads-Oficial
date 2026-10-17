import test from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_PROPERTIES } from "./properties.ts";
import { comodidadesQueNaoTem } from "./anuncio/nao-tem.ts";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O que o anúncio de exemplo AFIRMA fora da lista de comodidades (destaques, vagas, texto). */
function afirmacoes(p: (typeof SAMPLE_PROPERTIES)[number]): Record<string, boolean> {
  const texto = semAcento([p.title, p.description, ...(p.workFeatures ?? [])].join(" | "));
  return {
    "Wi-Fi": /wi-?fi|internet|fibra/.test(texto),
    "Vaga de garagem": (p.parkingSpots ?? 0) > 0 || /\bvaga|garagem/.test(texto),
    "Máquina de lavar": /maquina de lavar|lavadora/.test(texto),
  };
}

test("exemplos: o que o destaque ou o texto afirma não aparece em 'Não tem' (ordem f28ae366)", () => {
  assert.equal(SAMPLE_PROPERTIES.length, 15);
  const contradicoes: string[] = [];
  for (const p of SAMPLE_PROPERTIES) {
    const afirma = afirmacoes(p);
    for (const rotulo of comodidadesQueNaoTem(p)) {
      if (afirma[rotulo]) contradicoes.push(`${p.id}: "${rotulo}"`);
    }
  }
  assert.deepEqual(contradicoes, [], "itens em 'Não tem' que o próprio anúncio afirma ter");
});

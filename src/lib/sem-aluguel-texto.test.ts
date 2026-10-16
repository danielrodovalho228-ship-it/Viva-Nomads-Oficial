/*
  Barra "aluguel" (e "intermedeia") em texto que o público e os donos leem (ordem 0569d129, item 1):
  o termo certo é "valor mensal" / "valor do bloco". Comentários, nomes de variável (aluguelMensal) e o
  valor de dado "aluguel" (tipo de pagamento) ficam. /termos, /privacidade e modelos de contrato aguardam
  o parecer da Dra. Beatriz e não entram aqui.
  Roda: node --test src/lib/sem-aluguel-texto.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const GRUPOS: Record<string, string[]> = {
  "páginas públicas": ["src/components/property/price-card.tsx", "src/app/(public)/conferir/[codigo]/page.tsx"],
  "formulário do anúncio": [
    "src/app/(dashboard)/dashboard/imoveis/novo/page.tsx",
    "src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx",
  ],
  "simuladores do painel": [
    "src/app/(dashboard)/dashboard/simulador/page.tsx",
    "src/app/(dashboard)/dashboard/roi-imovel/page.tsx",
    "src/app/(dashboard)/dashboard/viabilidade/page.tsx",
  ],
  "contratos do painel": ["src/app/(dashboard)/dashboard/contratos/contratos-client.tsx"],
};

/** Tira comentários; o que sobra é código + texto de tela. */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;{}()])\/\/[^\n]*/g, "$1");
}

/** Ocorrências visíveis: palavra inteira, exceto o valor de dado "aluguel" (aspas coladas, minúsculo). */
export function ocorrenciasProibidas(src: string): string[] {
  const out: string[] = [];
  const limpo = semComentarios(src);
  for (const m of limpo.matchAll(/\b(alugu[eé](?:l|is)|intermedeia)\b/gi)) {
    const i = m.index ?? 0;
    const dadoInterno = m[0] === "aluguel" && /["'`]/.test(limpo[i - 1] ?? "") && /["'`]/.test(limpo[i + m[0].length] ?? "");
    if (!dadoInterno) out.push(limpo.slice(Math.max(0, i - 25), i + 35).replace(/\s+/g, " "));
  }
  return out;
}

test("o detector ignora comentário, variável e o valor de dado \"aluguel\"", () => {
  assert.deepEqual(ocorrenciasProibidas('// aluguel\n/* o aluguel */ const aluguelMensal = 1; tipo === "aluguel"'), []);
  assert.equal(ocorrenciasProibidas("<p>Aluguel do bloco</p>").length, 1);
  assert.equal(ocorrenciasProibidas('{t === "aluguel" ? "Aluguel" : "Caução"}').length, 1);
});

for (const [grupo, arquivos] of Object.entries(GRUPOS)) {
  for (const arq of arquivos) {
    test(`sem "aluguel" em texto visível (${grupo}): ${arq}`, () => {
      assert.deepEqual(ocorrenciasProibidas(readFileSync(arq, "utf8")), []);
    });
  }
}

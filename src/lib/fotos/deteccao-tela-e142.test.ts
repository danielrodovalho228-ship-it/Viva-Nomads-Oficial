import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analisarFotosNovas, type AnaliseParaGravar, type DepsDeteccao } from "./deteccao-fluxo.ts";
import { respostaLab } from "./deteccao.ts";

/*
  E142 (levantamento do Daniel, 25/10): o cartão "[TESTE QA]" (um print) foi lido como "Ar-condicionado na sala ·
  confiança 93%". Foto que parece tela (print, cartão, documento) não vai ao modelo e nunca vira sugestão.
*/
const foto = (n: number) => `dono/0000000${n}-0000-0000-0000-000000000000.webp`;

function deps(o: Partial<DepsDeteccao> = {}) {
  const chamadas = { modelo: 0, limite: 0 };
  const gravadas: AnaliseParaGravar[] = [];
  const d: DepsDeteccao = {
    ligada: true,
    fotos: async () => [foto(1), foto(2)],
    analisadas: async () => ({ caminhos: new Set(), hashes: new Set() }),
    baixar: async (c) => new TextEncoder().encode(c),
    hash: async (b) => new TextDecoder().decode(b),
    limite: async () => (chamadas.limite++, true),
    // O modelo "acharia" itens em qualquer foto, como no relato.
    modelo: async (_b, i) => (chamadas.modelo++, respostaLab(i)),
    gravar: async (a) => void gravadas.push(a),
    ...o,
  };
  return { d, chamadas, gravadas };
}

test("E142 — o print não vai ao modelo, não gasta cota e fica gravado sem itens", async () => {
  const { d, chamadas, gravadas } = deps({ pareceTela: async (b) => new TextDecoder().decode(b) === foto(1) });
  const r = await analisarFotosNovas(d);
  assert.equal(chamadas.modelo, 1, "só a foto 2 (a do imóvel) vai ao modelo");
  assert.equal(chamadas.limite, 1, "o print não consome a cota");
  assert.equal(r.telas, 1);
  const print = gravadas.find((g) => g.caminho === foto(1))!;
  assert.deepEqual(print.linhas, [], "nenhuma sugestão sai do print");
  assert.equal(print.valida, false);
});

test("E142 — sem a medida (laboratório), a rodada segue como antes", async () => {
  const { d, chamadas } = deps();
  await analisarFotosNovas(d);
  assert.equal(chamadas.modelo, 2);
});

test("E142 — a ação do servidor mede a tela com a mesma régua do Passo 2", () => {
  const acoes = readFileSync(new URL("../data/deteccao-actions.ts", import.meta.url), "utf8");
  assert.match(acoes, /pareceTela\(medirTela\(data, info\.width, info\.height\)\)/);
  assert.match(acoes, /pareceTela: simulado \? undefined : fotoPareceTela/);
});

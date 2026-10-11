import test from "node:test";
import assert from "node:assert/strict";
import { fontes, SYSTEM_VIVA } from "./viva-prompt.ts";
import { FAQ } from "./faq.ts";

test("a Viva sabe explicar como virar parceiro, com os links certos", () => {
  const f = fontes();
  for (const link of ["/parceiros/fotografos", "/empresas", "/auth", "/parceiros"]) {
    assert.ok(f.includes(link), `fontes sem ${link}`);
  }
  const p = FAQ.find((x) => x.id === "parceiro");
  assert.ok(p, "FAQ sem a pergunta de parceiro");
  assert.match(p.resposta, /Fotógrafo/);
  assert.match(p.resposta, /Empresa que hospeda equipes/);
  assert.match(p.resposta, /imóveis mobiliados/);
  assert.doesNotMatch(p.resposta, /apartamentos?|comiss[ãa]o|corretagem|intermedia[çc][ãa]o|aluguel/i);
});

test("a faixa menor citada é até 6%, nunca 4% (faixas 12/10/8/6%)", () => {
  assert.match(SYSTEM_VIVA, /menor a taxa \(até 6%\)/);
  assert.doesNotMatch(SYSTEM_VIVA, /até 4%/);
});

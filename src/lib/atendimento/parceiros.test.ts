// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
/*
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): a menor taxa citada pela Viva é "até 6%" (16–19 imóveis);
  "até 4%" (o Plano Gestor, que deixou de ser oferta pública) passou a ser o texto proibido.
*/
import test from "node:test";
import assert from "node:assert/strict";
import { fontes, SYSTEM_VIVA } from "./viva-prompt.ts";
import { FAQ } from "./faq.ts";

test("a Viva sabe explicar como virar parceiro, com os links certos", () => {
  const f = fontes();
  for (const link of ["/parceiros/fotografos", "/empresas", "/auth", "/parceiros"]) {
    assert.ok(f.includes(link), `fontes sem ${link}`);
  }
  const p = FAQ.find((x) => x.id === "como-virar-parceiro");
  assert.ok(p, "FAQ sem a pergunta de parceiro");
  assert.match(p.resposta, /Fotografia/);
  assert.match(p.resposta, /Empresa que quer ser parceira[^.]*\/parceiros/);
  assert.match(p.resposta, /Empresa que quer moradia para funcionários: \/empresas/);
  assert.match(p.resposta, /imóveis mobiliados/);
  assert.doesNotMatch(p.resposta, /apartamentos?|comiss[ãa]o|corretagem|intermedia[çc][ãa]o|aluguel/i);
});

test("E564/078: a faixa menor citada é até 6% (16–19 imóveis), nunca mais 'até 4%' (o Plano Gestor saiu)", () => {
  // 078 (Daniel, 16/11/2026): a menor taxa da escada pública voltou a ser 6% (antes /menor a taxa \(até 4%\)/).
  assert.match(SYSTEM_VIVA, /menor a taxa \(até 6%\)/);
  // 078 (Daniel, 16/11/2026): o proibido inverteu — antes era "até 6%"; agora é "até 4%" (a taxa do Plano Gestor, que saiu).
  assert.doesNotMatch(SYSTEM_VIVA, /até 4%/);
});

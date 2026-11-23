/*
  E1092 (ORDEM-DUET-446, classe B): a página web do laudo assinado, na vista do AVALIADOR, mostrava resultado, data e
  hash, mas não o nível. O PDF diz "Nível sustentado: Conforto" e a vista do dono mostra o nível. A vista do avaliador
  passa a dizer a mesma linha do PDF, pelo valor gravado no laudo (o que o avaliador escolheu e assinou — E1083).
  Roda: node --test src/lib/vistoria/e1092-nivel-na-vista-do-avaliador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhaNivelSustentado } from "./nivel-do-laudo.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("E1092: a linha do nível é a do PDF, pelo valor gravado no laudo", () => {
  assert.equal(linhaNivelSustentado("conforto"), "Nível sustentado: Conforto");
  assert.equal(linhaNivelSustentado("essencial"), "Nível sustentado: Essencial");
  assert.equal(linhaNivelSustentado("premium"), "Nível sustentado: Premium");
  // Laudo antigo ou reprovado, sem nível sustentado: o mesmo texto que o dono lê.
  assert.equal(linhaNivelSustentado("em_adequacao"), "Nível sustentado: em adequação");
  // Sem valor gravado (ou lixo), a linha não aparece — nunca um nível inventado.
  assert.equal(linhaNivelSustentado(null), null);
  assert.equal(linhaNivelSustentado(""), null);
  assert.equal(linhaNivelSustentado("ouro"), null);
});

test("E1092: a vista do avaliador mostra o nível junto do resultado; o PDF segue com o mesmo rótulo", () => {
  const pagina = ler("../../app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  const bloco = pagina.slice(pagina.indexOf('data-testid="avaliador-laudo"'));
  assert.ok(bloco.length > 0, "o bloco do laudo do avaliador existe");
  const resultado = bloco.indexOf("Resultado: {ROTULO_RESULTADO[laudo.resultado]}");
  const nivel = bloco.indexOf('data-testid="avaliador-laudo-nivel"');
  const selo = bloco.indexOf("<SeloAssinatura");
  assert.ok(resultado > 0 && nivel > resultado && nivel < selo, "o nível vem logo depois do resultado, antes do selo da assinatura");
  assert.match(bloco, /linhaNivelSustentado\(laudo\.nivel_sustentado\)/);
  assert.ok(ler("./laudo-documento.ts").includes('["Nível sustentado", ROTULO_NIVEL_LAUDO[d.nivel]]'), "o PDF usa o mesmo rótulo");
});

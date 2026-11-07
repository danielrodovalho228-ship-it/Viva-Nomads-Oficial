/*
  Regressão do laboratório (07/11): as specs t229 e t231 abrem /admin/pendencias e leem cada fila por
  [data-precisa="<chave>"] com [data-href]/[data-valor] dentro, no contêiner "central-decisoes".
  A página só tinha data-decisao e data-n, então as duas specs não achavam a fila. Guarda a fonte da página e das specs.
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (c: string) => readFileSync(new URL(c, import.meta.url), "utf8");
const pagina = ler("../../app/(dashboard)/admin/pendencias/page.tsx");

test("Pendências: toda fila do topo e toda decisão de outra tela expõe data-precisa, data-href e data-valor", () => {
  const topo = pagina.slice(pagina.indexOf('data-decisao={f.chave}'), pagina.indexOf("</li>", pagina.indexOf('data-decisao={f.chave}')));
  assert.match(topo, /data-precisa=\{f\.chave\}/);
  assert.match(topo, /data-href=\{hrefCentral\(f\.chave\)\}/);
  assert.match(topo, /data-valor=\{contagens\[f\.chave\]\}/);
  const outra = pagina.slice(pagina.indexOf("function LinhaDecisao"), pagina.indexOf("function Linha("));
  assert.match(outra, /data-precisa=\{l\.chave\}/);
  assert.match(outra, /data-href=\{l\.href\}/);
  assert.match(outra, /data-valor=\{l\.n\}/);
});

test("specs t229 e t231 esperam o contêiner certo em /admin/pendencias (central-decisoes), não o da inicial", () => {
  for (const s of ["t229-admin-conversa-com-tudo", "t231-admin-numeros-com-lista"]) {
    const f = ler(`../../../tests/e2e/specs/${s}.spec.ts`);
    assert.match(f, /getByTestId\("central-decisoes"\)/, s);
    assert.doesNotMatch(f, /getByTestId\("admin-decisoes"\)[^\n]*\n[^\n]*\n?[^\n]*pendencias/i, s);
  }
  assert.doesNotMatch(ler("../../../tests/e2e/specs/t229-admin-conversa-com-tudo.spec.ts"), /admin-decisoes"\)\)\.toBeVisible/);
  assert.doesNotMatch(ler("../../../tests/e2e/specs/t231-admin-numeros-com-lista.spec.ts"), /admin-decisoes"\)\)\.toBeVisible/);
});

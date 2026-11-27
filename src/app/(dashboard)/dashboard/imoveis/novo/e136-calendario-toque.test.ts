/* Roda: node --test "src/app/(dashboard)/dashboard/imoveis/novo/e136-calendario-toque.test.ts"
  E136 (resíduo): no cadastro, a 390 px no TOQUE, o campo de data ainda abria o seletor NATIVO do aparelho (no idioma
  dele: "October 2026", "Sun Mon…"). Agora o toque no campo abre o calendário do site (`CalendarioBR`, o mesmo do
  computador), sem teclado e sem cair no nativo. Vale para "Disponível a partir de" e "Disponível até" (Passo 9).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const campos = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/campos.tsx", "utf8");
const campoData = readFileSync("src/components/ui/campo-data.tsx", "utf8");
const bloco = (src: string, inicio: string, fim: string) => src.slice(src.indexOf(inicio), src.indexOf(fim, src.indexOf(inicio)));

test("E136: o campo de data do cadastro não tem mais o seletor nativo — toque e computador usam CampoDataTexto", () => {
  const unico = bloco(campos, "export function CampoDataUnico", "\n}\n");
  assert.doesNotMatch(unico, /type="date"/, "nenhum <input type=date> no CampoDataUnico");
  assert.match(unico, /<CampoDataTexto/);
  assert.match(unico, /abrirAoTocar=\{toque\}/, "no toque, tocar no campo abre o calendário do site");
});

test("E136: CampoDataTexto com abrirAoTocar — sem teclado, e o toque no campo abre o CalendarioBR", () => {
  const texto = bloco(campoData, "export function CampoDataTexto", "\n}\n");
  assert.match(texto, /abrirAoTocar/);
  assert.match(texto, /inputMode=\{abrirAoTocar \? "none" : "numeric"\}/, "no toque, o campo não chama o teclado");
  assert.match(texto, /onClick=\{abrirAoTocar \? \(\) => setAberto\(true\) : undefined\}/, "o toque no campo abre o calendário");
});

test("E136: os dois campos do Passo 9 seguem sendo CampoDataUnico", () => {
  const preco = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx", "utf8");
  assert.equal((preco.match(/<CampoDataUnico/g) ?? []).length, 2);
});

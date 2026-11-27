/* Roda: node --test src/lib/e450-anunciar-topo.test.ts — E450: o "Anunciar" do topo não joga o dono no login. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("E450: 'Anunciar' do topo público vai a /para-proprietarios, o mesmo destino do CTA de donos e do rodapé", () => {
  const nav = ler("lib/constants.ts").match(/export const PUBLIC_NAV = comPortasDePrecos\(\[([\s\S]*?)\] as/)![1];
  assert.match(nav, /\{ href: "\/para-proprietarios", label: "Anunciar" \}/);
  // Nenhum item do topo leva direto ao cadastro (rota com login, que vira a parede /auth?motivo=anunciar).
  assert.doesNotMatch(nav, /\/dashboard\/imoveis\/novo/);
  // Os outros dois caminhos já iam à página pública do dono.
  assert.match(ler("components/layout/footer.tsx"), /<FooterLink href="\/para-proprietarios">Para proprietários<\/FooterLink>/);
});

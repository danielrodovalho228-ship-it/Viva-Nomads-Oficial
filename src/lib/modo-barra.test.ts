/*
  Barra de modo Proprietário ⇄ Inquilino (ordem 5522b5dd).
  Roda: node --test src/lib/modo-barra.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textoDaBarra, avisoDeTroca, rotuloDoBotaoTrocar, outroModo, CORES_BARRA } from "./modo-barra.ts";
import { TENANT_TABS, OWNER_TABS, TENANT_APP_TABS, OWNER_APP_TABS } from "./nav-mobile.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const rotulos = (t: { label: string }[]) => t.map((x) => x.label);

test("textos da barra e do aviso de troca", () => {
  assert.equal(textoDaBarra("owner"), "Você está como Proprietário");
  assert.equal(textoDaBarra("tenant"), "Você está como Inquilino");
  assert.equal(avisoDeTroca("tenant"), "Agora você está como Inquilino");
  assert.equal(rotuloDoBotaoTrocar("owner"), "Trocar para Inquilino");
  assert.equal(outroModo("tenant"), "owner");
});

test("cores: proprietário verde, inquilino azul", () => {
  assert.match(CORES_BARRA.owner, /emerald/);
  assert.match(CORES_BARRA.tenant, /blue/);
});

test("abas por modo (site e app) seguem a ordem do Daniel", () => {
  const dono = ["Painel", "Imóveis", "Interessados", "Mensagens", "Conta"];
  const inq = ["Buscar", "Favoritos", "Candidaturas", "Mensagens", "Conta"];
  assert.deepEqual(rotulos(OWNER_TABS), dono);
  assert.deepEqual(rotulos(OWNER_APP_TABS), dono);
  assert.deepEqual(rotulos(TENANT_TABS), inq);
  assert.deepEqual(rotulos(TENANT_APP_TABS), inq);
});

test("a casca usa a barra em todas as telas logadas, inclusive no app (sem web-only)", () => {
  const shell = ler("components/layout/dashboard-shell.tsx");
  assert.match(shell, /<ModoBarra mode=\{mode\} onSwitch=\{switchTo\}/);
  const barra = ler("components/layout/modo-barra.tsx");
  assert.doesNotMatch(barra, /web-only/);
  assert.match(barra, /aria-live="polite"/);
  assert.match(barra, /Trocar/);
});

test("animação ≤ 600 ms e só com movimento permitido", () => {
  const css = ler("app/globals.css");
  const bloco = css.slice(css.indexOf(".modo-icone"));
  const dur = Number(/animation: modo-icone ([\d.]+)s/.exec(bloco)?.[1]);
  assert.ok(dur > 0 && dur <= 0.6);
  const antes = css.slice(0, css.indexOf(".modo-icone"));
  assert.ok(antes.lastIndexOf("@media (prefers-reduced-motion: no-preference)") > antes.lastIndexOf("\n}\n"));
  assert.match(ler("components/layout/modo-barra.tsx"), /motion-reduce:transition-none/);
});

test("Conta: seletor de dois lados e sem 'Plano e assinatura'", () => {
  const c = ler("components/account/conta-menu.tsx");
  assert.match(c, /<SeletorModo mode=\{mode\} onSwitch=\{trocarModo\}/);
  assert.doesNotMatch(c, /Plano e assinatura/);
  assert.doesNotMatch(c, /Usar como \$\{/);
  assert.match(ler("components/account/seletor-modo.tsx"), /role="radiogroup"/);
});

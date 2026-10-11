/*
  Chip de modo Proprietário ⇄ Inquilino no cabeçalho (ordem 5522b5dd, refeita).
  Roda: node --test src/lib/modo-barra.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { rotuloDoChip, avisoDeTroca, rotuloDoBotaoTrocar, outroModo, CORES_CHIP } from "./modo-barra.ts";
import { TENANT_TABS, OWNER_TABS, TENANT_APP_TABS, OWNER_APP_TABS } from "./nav-mobile.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const rotulos = (t: { label: string }[]) => t.map((x) => x.label);

test("rótulo do chip e aviso de troca", () => {
  assert.equal(rotuloDoChip("owner"), "Proprietário");
  assert.equal(rotuloDoChip("tenant"), "Inquilino");
  assert.equal(avisoDeTroca("tenant"), "Agora você está como Inquilino");
  assert.equal(rotuloDoBotaoTrocar("owner"), "Trocar para Inquilino");
  assert.equal(outroModo("tenant"), "owner");
});

test("cores: proprietário verde, inquilino azul", () => {
  assert.match(CORES_CHIP.owner, /emerald/);
  assert.match(CORES_CHIP.tenant, /blue/);
});

test("abas por modo (site e app) seguem a ordem do Daniel", () => {
  const dono = ["Painel", "Imóveis", "Interessados", "Mensagens", "Conta"];
  const inq = ["Buscar", "Favoritos", "Candidaturas", "Mensagens", "Conta"];
  assert.deepEqual(rotulos(OWNER_TABS), dono);
  assert.deepEqual(rotulos(OWNER_APP_TABS), dono);
  assert.deepEqual(rotulos(TENANT_TABS), inq);
  assert.deepEqual(rotulos(TENANT_APP_TABS), inq);
});

test("chip no cabeçalho do site e do app; faixa de largura total removida", () => {
  const shell = ler("components/layout/dashboard-shell.tsx");
  assert.match(shell, /<ModoChip mode=\{mode\} onSwitch=\{switchTo\}/);
  assert.match(shell, /<AppHeader direita=\{chipModo\}/);
  assert.doesNotMatch(shell, /ModoBarra|Você está como/);
  assert.equal(existsSync(new URL("../components/layout/modo-barra.tsx", import.meta.url)), false);
  const chip = ler("components/layout/modo-chip.tsx");
  assert.doesNotMatch(chip, /web-only/);
  assert.match(chip, /aria-live="polite"/);
  assert.match(chip, /<Avatar name=\{nome\} size=\{28\} photoUrl=\{photoUrl\}/); // foto ou iniciais
  assert.match(chip, /rotuloDoChip\(mode\)/);
  assert.match(chip, /onSwitch\(outroModo\(mode\)\)/);
  // A altura do cabeçalho do app não cresce (h-12 mantido; chip h-10).
  assert.match(ler("components/app/app-header.tsx"), /h-12/);
  assert.match(chip, /h-10/);
});

test("troca de modo persiste no perfil antes de navegar", () => {
  const shell = ler("components/layout/dashboard-shell.tsx");
  assert.match(shell, /await salvarModo\(next\)/);
  assert.match(ler("components/account/conta-menu.tsx"), /await salvarModo\(outro\)/);
});

test("animação 'virada de chave' ≤ 600 ms e só com movimento permitido", () => {
  const css = ler("app/globals.css");
  const bloco = css.slice(css.indexOf(".modo-chave"));
  const dur = Number(/animation: modo-chave ([\d.]+)s/.exec(bloco)?.[1]);
  assert.ok(dur > 0 && dur <= 0.6);
  const antes = css.slice(0, css.indexOf(".modo-chave"));
  assert.ok(antes.lastIndexOf("@media (prefers-reduced-motion: no-preference)") > antes.lastIndexOf("\n}\n"));
  assert.match(ler("components/layout/modo-chip.tsx"), /motion-reduce:transition-none/);
});

test("Conta: um só ponto de troca, cartão com foto que leva ao Perfil", () => {
  const c = ler("components/account/conta-menu.tsx");
  assert.match(c, /<SeletorModo mode=\{mode\} onSwitch=\{trocarModo\}/);
  assert.doesNotMatch(c, /Plano e assinatura/);
  assert.doesNotMatch(c, /Usando como/);
  assert.match(c, /href="\/dashboard\/conta\/perfil"[\s\S]*<Avatar [^>]*size=\{56\}/);
  assert.match(ler("components/account/seletor-modo.tsx"), /role="radiogroup"/);
});

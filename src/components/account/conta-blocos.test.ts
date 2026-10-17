/*
  Conta em 4 blocos (prompt 18): cada assunto uma vez e o simulador tributário só em Ferramentas.
  Roda: node --test src/components/account/conta-blocos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const CONTA = ler("src/app/(dashboard)/dashboard/conta/page.tsx");

test("Conta: 4 blocos na ordem Perfil público → Dados da conta → Confiança e segurança → Preferências", () => {
  const ordem = ["Perfil público", "Dados da conta", "Confiança e segurança", "Preferências"].map((t) => CONTA.indexOf(`titulo="${t}"`));
  assert.ok(ordem.every((i) => i > 0), `faltou bloco: ${ordem}`);
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem);
});

test("Conta: sem repetições — senha, verificação e 'Perfil do modo' saíram da página longa", () => {
  assert.doesNotMatch(CONTA, /<ChangePassword|PerfilDoModo|title="Verificação"|title="Segurança"|TaxSimulator/);
  assert.equal(CONTA.match(/<ConfiancaLista \/>/g)?.length, 1);
  assert.equal(CONTA.match(/<AvatarUploader \/>/g)?.length, 1);
});

test("simulador tributário: fora da Conta e do cadastro; fica em /tributario", () => {
  assert.doesNotMatch(ler("src/components/account/conta-secoes.tsx"), /TaxSimulator/);
  assert.doesNotMatch(ler("src/app/auth/page.tsx"), /TaxSimulator/);
  assert.match(ler("src/app/tributario/page.tsx"), /<TaxSimulator \/>/);
  assert.doesNotMatch(ler("src/app/(dashboard)/dashboard/ferramentas/page.tsx"), /conta#tributacao/);
});

test("menu: 'Verificação' aponta para a lista de Confiança e segurança", () => {
  assert.match(ler("src/config/menu-painel.ts"), /rotulo: "Verificação", icone: "verificacao", href: "\/dashboard\/conta#confianca"/);
});

test("simulador: PJ sem '+ IBS/CBS', sem aviso de ago/2026 e com o custo de manter a empresa", () => {
  const sim = ler("src/components/tax-simulator.tsx");
  assert.doesNotMatch(sim, /Lucro presumido \+ IBS\/CBS|ago\/2026/);
  assert.match(sim, /custo de manter a empresa/);
  assert.match(sim, /AVISO_IBS_CBS_LIBERADO && r\.ibsCbsAviso/);
});

/*
  E1026 (18/11) — o cabeçalho do parceiro nascia como dono logo depois do login. O papel do cabeçalho vinha só do que o
  navegador guarda (parceiroAtivo), que no login nasce `false` e só vira `true` quando o AuthProvider termina de ler o
  perfil. Na página de chegada do login o sino do dono aparecia e trocava para o do parceiro (5 de 5 no laboratório);
  uma tela aberta nesse intervalo nascia igual (a falha solta do t886, 1 em 38).
  Correção: enquanto o navegador ainda não conhece o papel desta conta, vale o papel que o SERVIDOR leu ao montar o
  painel. Depois que o navegador o conhece (leitura do perfil ou troca explícita), vale o do navegador, como antes.
  Roda: node --test src/lib/papel/e1026-papel-inicial.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parceiroInicialDoServidor, preferenciaParceiroEfetiva } from "./papel-inicial.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const CARIMBO = "2026-11-18T10:00:00.000Z";

test("E1026, servidor: parceiro só com o papel gravado, o carimbo da escolha (E668) e a parceria ativa", () => {
  assert.equal(parceiroInicialDoServidor({ papelAtivo: "parceiro", escolhidoEm: CARIMBO, parceriaAtiva: true }), true);
  // Sem o carimbo o "parceiro" gravado não vale (E668); sem parceria ativa, também não (suspensa ou ainda em análise).
  assert.equal(parceiroInicialDoServidor({ papelAtivo: "parceiro", escolhidoEm: null, parceriaAtiva: true }), false);
  assert.equal(parceiroInicialDoServidor({ papelAtivo: "parceiro", escolhidoEm: CARIMBO, parceriaAtiva: false }), false);
  for (const papelAtivo of ["proprietario", "morador", null, undefined, "equipe"])
    assert.equal(parceiroInicialDoServidor({ papelAtivo, escolhidoEm: CARIMBO, parceriaAtiva: true }), false, String(papelAtivo));
});

test("E1026, navegador: enquanto o papel desta conta não é conhecido, vale o que o servidor leu", () => {
  const servidor = { conta: "clara", parceiro: true };
  // Logo depois do login: o navegador guarda `false` (ainda não leu o perfil) e o servidor diz parceiro.
  assert.equal(preferenciaParceiroEfetiva({ guardado: false, papelConhecido: false, conta: "clara", servidor }), true);
  // E o contrário: o aparelho guarda "parceiro" de outra época e o servidor diz que não é mais.
  assert.equal(preferenciaParceiroEfetiva({ guardado: true, papelConhecido: false, conta: "clara", servidor: { conta: "clara", parceiro: false } }), false);
});

test("E1026, navegador: papel conhecido (perfil lido ou troca explícita) vence o servidor — o layout não se refaz ao navegar", () => {
  const servidor = { conta: "clara", parceiro: true };
  // A pessoa trocou para proprietário no selo: o que o servidor leu ao montar o painel ficou velho.
  assert.equal(preferenciaParceiroEfetiva({ guardado: false, papelConhecido: true, conta: "clara", servidor }), false);
  assert.equal(preferenciaParceiroEfetiva({ guardado: true, papelConhecido: true, conta: "clara", servidor: { conta: "clara", parceiro: false } }), true);
});

test("E1026, navegador: sem leitura do servidor, ou leitura de OUTRA conta, fica o que o navegador guarda (como antes)", () => {
  for (const guardado of [false, true]) {
    assert.equal(preferenciaParceiroEfetiva({ guardado, papelConhecido: false, conta: "clara", servidor: null }), guardado);
    assert.equal(preferenciaParceiroEfetiva({ guardado, papelConhecido: false, conta: "clara", servidor: { conta: "lucas", parceiro: !guardado } }), guardado);
    assert.equal(preferenciaParceiroEfetiva({ guardado, papelConhecido: false, conta: null, servidor: { conta: "clara", parceiro: !guardado } }), guardado);
  }
});

test("E1026: o store guarda se o papel da conta já é conhecido; outra conta e sair recomeçam do zero", () => {
  const store = ler("src/lib/store.ts");
  assert.match(store, /papelConhecido: boolean;/);
  // Persistido: uma tela aberta logo depois do login precisa saber que o papel ainda não foi lido.
  const persistido = store.slice(store.indexOf("partialize: (s) => ({"));
  assert.match(persistido, /papelConhecido: s\.papelConhecido,/);
  const setUser = store.slice(store.indexOf("setUser: (user) => {"), store.indexOf("setActiveMode: (activeMode)"));
  assert.match(setUser, /parceiroAtivo: troca\.parceiroAtivo, papelConhecido: false,/);
  const sair = store.slice(store.indexOf("signOut: () => {"));
  assert.match(sair, /parceiroAtivo: false, papelConhecido: false,/);
  // A troca explícita pelo selo ou pela Conta é papel conhecido.
  const setPapel = store.slice(store.indexOf("setPapel: (papel) =>"), store.indexOf("activateRole: (mode) =>"));
  assert.equal((setPapel.match(/papelConhecido: true/g) ?? []).length, 2);
});

test("E1026: o AuthProvider marca o papel como conhecido quando termina de ler o perfil (com ou sem papel gravado)", () => {
  const auth = ler("src/components/auth-provider.tsx");
  const leitura = auth.slice(auth.indexOf("const gravado = papelGravadoEfetivo(gravadoBruto, escolhidoEm);"), auth.indexOf("perfilLido.delete(u.id); // tenta de novo"));
  assert.match(leitura, /if \(useAuthStore\.getState\(\)\.user\?\.id === u\.id\) useAuthStore\.setState\(\{ papelConhecido: true \}\);/);
});

test("E1026: o painel lê o papel no servidor e o entrega à casca por contexto; os ganchos do papel usam a regra", () => {
  const layout = ler("src/app/(dashboard)/layout.tsx");
  assert.match(layout, /comLimite\(papelInicialDoServidor\(\), LIMITE_CASCA_MS\)\.catch\(\(\) => null\)/);
  assert.match(layout, /<PapelInicialProvider valor=\{papelInicial\}>/);
  // Nunca pelo store global no servidor (E793, risco H1): prop + contexto.
  const servidor = ler("src/lib/papel/papel-inicial-servidor.ts");
  assert.doesNotMatch(servidor, /useAuthStore/);
  assert.match(servidor, /parceiroInicialDoServidor\(/);
  const gancho = ler("src/lib/use-papel-barra.ts");
  assert.match(gancho, /preferenciaParceiroEfetiva\(\{ guardado, papelConhecido, conta, servidor \}\)/);
  // A espera pela leitura da aprovação (E464) parte da mesma preferência, e não do valor cru do navegador.
  const aprovado = gancho.slice(gancho.indexOf("export function useParceiroAprovado"));
  assert.match(aprovado, /const preferencia = usePreferenciaParceiro\(\);/);
  // Quem decide o papel em uso na Conta e a sincronização por área leem pela mesma porta.
  assert.match(ler("src/components/account/use-papel-em-uso.ts"), /const parceiroAtivo = usePreferenciaParceiro\(\);/);
  assert.match(ler("src/components/papel/sincronizar-papel.tsx"), /const parceiroAtivo = usePreferenciaParceiro\(\);/);
});

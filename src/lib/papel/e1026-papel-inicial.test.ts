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
import { anotarModoDoServidor, modoAnotadoDoServidor, trocaDaPessoaNoMeio } from "./modo-do-servidor.ts";

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

test("E1026: o AuthProvider só marca o papel como conhecido quando a leitura do perfil foi APLICADA", () => {
  // 2ª causa, achada no refresco (18/11): na chegada do login o ModeInitializer muda o modo de null para o do servidor
  // enquanto o perfil é lido; o AuthProvider toma isso por troca da pessoa (semTrocaNoMeio = false) e NÃO aplica o papel
  // lido. Marcar "conhecido" nesse caso deixava o store a dizer "não é parceiro" como se fosse certo, e a tela seguinte
  // nascia com o cabeçalho do dono (4 em 24 no laboratório). Leitura não aplicada = papel ainda desconhecido.
  const auth = ler("src/components/auth-provider.tsx");
  const leitura = auth.slice(auth.indexOf("const gravado = papelGravadoEfetivo(gravadoBruto, escolhidoEm);"), auth.indexOf("perfilLido.delete(u.id); // tenta de novo"));
  assert.match(leitura, /if \(semTrocaNoMeio && useAuthStore\.getState\(\)\.user\?\.id === u\.id\) useAuthStore\.setState\(\{ papelConhecido: true \}\);/);
  assert.equal((auth.match(/papelConhecido: true/g) ?? []).length, 1, "nenhuma outra marcação no AuthProvider");
});

test("E1026: a troca de modo pela pessoa (link de outra área) também é papel conhecido", () => {
  // setActiveMode desliga o parceiro (E464). Se o papel ainda fosse "desconhecido", o do servidor (parceiro) venceria a
  // escolha que a pessoa acabou de fazer. A marcação fica no gesto, ao lado da troca.
  const casca = ler("src/components/layout/dashboard-shell.tsx");
  const aoNavegar = casca.slice(casca.indexOf("async function aoNavegar("), casca.indexOf("// Conta única (ordem a8c05cd0)"));
  assert.match(aoNavegar, /setActiveMode\(alvo\);\n\s+useAuthStore\.setState\(\{ papelConhecido: true \}\);/);
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

test("E1026, 2ª causa: o modo que o ModeInitializer aplica no meio da leitura do perfil não é troca da pessoa", () => {
  // Chegada do login: o store nasce sem modo (null); o ModeInitializer aplica o do servidor (owner) enquanto o perfil é
  // lido. Antes, isso contava como "a pessoa trocou" e o papel lido era descartado.
  assert.equal(trocaDaPessoaNoMeio({ pendente: false, modoAntes: null, modoAgora: "owner", modoDoServidor: "owner" }), false);
  assert.equal(trocaDaPessoaNoMeio({ pendente: false, modoAntes: "tenant", modoAgora: "owner", modoDoServidor: "owner" }), false);
  // Nada mudou: não houve troca.
  assert.equal(trocaDaPessoaNoMeio({ pendente: false, modoAntes: "owner", modoAgora: "owner", modoDoServidor: "owner" }), false);
  assert.equal(trocaDaPessoaNoMeio({ pendente: false, modoAntes: null, modoAgora: null, modoDoServidor: null }), false);
});

test("E1026, 2ª causa: a troca da pessoa continua a vencer o perfil lido (o que a regra antiga protegia)", () => {
  // Mudou para um modo que NÃO é o que o servidor mandou aplicar nesta carga: foi a pessoa.
  assert.equal(trocaDaPessoaNoMeio({ pendente: false, modoAntes: "owner", modoAgora: "tenant", modoDoServidor: "owner" }), true);
  assert.equal(trocaDaPessoaNoMeio({ pendente: false, modoAntes: null, modoAgora: "tenant", modoDoServidor: "owner" }), true);
  assert.equal(trocaDaPessoaNoMeio({ pendente: false, modoAntes: null, modoAgora: "owner", modoDoServidor: null }), true);
  // Troca recente ainda não confirmada pelo servidor (bug 6 da L2): vence sempre, mesmo que o modo pareça igual.
  for (const modoAgora of ["owner", "tenant", null] as const)
    assert.equal(trocaDaPessoaNoMeio({ pendente: true, modoAntes: "owner", modoAgora, modoDoServidor: "owner" }), true);
});

test("E1026, 2ª causa: o ModeInitializer anota o modo que aplica e o AuthProvider usa a regra", () => {
  anotarModoDoServidor("owner");
  assert.equal(modoAnotadoDoServidor(), "owner");
  anotarModoDoServidor(null);
  assert.equal(modoAnotadoDoServidor(), null);
  const ini = ler("src/components/layout/mode-initializer.tsx");
  // Anota ANTES de aplicar, nos dois caminhos (o modo que veio com a página e o relido depois de um atraso).
  assert.match(ini, /anotarModoDoServidor\(modo\);\n\s+if \(modo\) useAuthStore\.setState\(\{ activeMode: modo \}\);/);
  assert.match(ini, /if \(aplicar\) \{\n\s+anotarModoDoServidor\(aplicar\);\n\s+useAuthStore\.setState\(\{ activeMode: aplicar \}\);/);
  const auth = ler("src/components/auth-provider.tsx");
  assert.match(auth, /const semTrocaNoMeio = !trocaDaPessoaNoMeio\(\{ pendente: !!pendente, modoAntes, modoAgora: useAuthStore\.getState\(\)\.activeMode, modoDoServidor: modoAnotadoDoServidor\(\) \}\);/);
});

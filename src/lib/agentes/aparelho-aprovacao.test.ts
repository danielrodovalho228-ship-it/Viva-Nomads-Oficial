/* Roda: node --test src/lib/agentes/aparelho-aprovacao.test.ts
   Ordem 12a8086d, item 4: trilha de auditoria da aprovação diz DE QUAL APARELHO veio a decisão.
   O registro é um resumo de vocabulário fixo (nunca o user-agent cru, nunca IP). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoDoAparelho, APARELHO_MAX } from "./aparelho.ts";
import { decidirAprovacao, type DepsDecidir, type LinhaAprovacao } from "./decidir-aprovacao.ts";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  appIphone: "Mozilla/5.0 (iPhone) VivaNomadsApp/1.0 (expo)",
  appAndroid: "Mozilla/5.0 (Linux; Android 14; wv) VivaNomadsApp/1.0 (expo)",
  windowsEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  macFirefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
};

test("resume o aparelho em palavras fixas: tipo · sistema · navegador", () => {
  assert.equal(resumoDoAparelho(UA.iphoneSafari), "Celular · iPhone · Safari");
  assert.equal(resumoDoAparelho(UA.androidChrome), "Celular · Android · Chrome");
  assert.equal(resumoDoAparelho(UA.appIphone), "App Viva Nomads · iPhone");
  assert.equal(resumoDoAparelho(UA.appAndroid), "App Viva Nomads · Android");
  assert.equal(resumoDoAparelho(UA.windowsEdge), "Computador · Windows · Edge");
  assert.equal(resumoDoAparelho(UA.macFirefox), "Computador · Mac · Firefox");
  assert.equal(resumoDoAparelho(UA.ipad), "Tablet · iPad · Safari");
});

test("sem user-agent ou desconhecido: 'Aparelho não identificado'", () => {
  assert.equal(resumoDoAparelho(null), "Aparelho não identificado");
  assert.equal(resumoDoAparelho(""), "Aparelho não identificado");
  assert.equal(resumoDoAparelho("curl/8.5.0"), "Aparelho não identificado");
});

test("nunca copia texto do user-agent (sem versão, sem modelo, sem injeção) e cabe no limite", () => {
  const malicioso = "Mozilla/5.0 (Linux; Android 14; <script>alert(1)</script> 'drop table) Chrome/1 Mobile";
  const r = resumoDoAparelho(malicioso);
  assert.equal(r, "Celular · Android · Chrome");
  for (const ua of [...Object.values(UA), malicioso, "x".repeat(5000)]) {
    const s = resumoDoAparelho(ua);
    assert.ok(s.length <= APARELHO_MAX, s);
    assert.doesNotMatch(s, /\d|Pixel|<|'/);
  }
});

const linha: LinhaAprovacao = { id: "a1", tipo: "decisao", referencia: "D-12", status: "pendente", hashConteudo: null, expiraEm: new Date("2026-10-12T12:00:00Z") };

function fake() {
  const gravadas: { status: string; aparelho: string }[] = [];
  const deps: DepsDecidir = {
    agora: new Date("2026-10-10T12:00:00Z"),
    admin: { id: "u1", ultimoLoginEm: new Date("2026-10-10T11:55:00Z") },
    carregar: async () => ({ ...linha }),
    gravar: async (_id, status, _admin, _q, aparelho) => (gravadas.push({ status, aparelho }), true),
    expirar: async () => {},
  };
  return { deps, gravadas };
}

test("a decisão grava o resumo do aparelho junto de quem e quando (aprovar e recusar)", async () => {
  const a = fake();
  assert.equal((await decidirAprovacao(a.deps, "a1", { acao: "aprovar", confirmar: true, userAgent: UA.iphoneSafari })).http, 200);
  assert.deepEqual(a.gravadas, [{ status: "aprovada", aparelho: "Celular · iPhone · Safari" }]);
  const r = fake();
  assert.equal((await decidirAprovacao(r.deps, "a1", { acao: "recusar", confirmar: false, userAgent: UA.windowsEdge })).http, 200);
  assert.deepEqual(r.gravadas, [{ status: "recusada", aparelho: "Computador · Windows · Edge" }]);
});

test("sem user-agent a decisão ainda vale e registra 'Aparelho não identificado'", async () => {
  const a = fake();
  assert.equal((await decidirAprovacao(a.deps, "a1", { acao: "aprovar", confirmar: true })).http, 200);
  assert.deepEqual(a.gravadas, [{ status: "aprovada", aparelho: "Aparelho não identificado" }]);
});

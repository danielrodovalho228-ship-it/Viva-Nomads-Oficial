/*
  E744 (triagem do t187, ORDEM-DUET-073) — o global-setup diz EM QUE PASSO o login de um papel falhou.
  O t187 falhou num laboratório local com "[global-setup] login de "admin" falhou depois de 3 tentativas", sem dizer
  mais nada; no CI e em outro laboratório local, sobre a mesma main, passa 5 de 5. A mensagem crua era
  "page.waitForURL: Timeout 20000ms exceeded" tanto para senha recusada quanto para o código de duas etapas recusado.
  Reproduzido: com um TESTES_ADMIN_TOTP_SEGREDO que não é o do fator atual da conta (laboratório semeado de novo com
  as variáveis antigas no shell), o erro é exatamente esse. Agora a mensagem diz o passo, a tela e o que a tela disse.
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mensagemDaFalhaDeLogin } from "../e2e/fixtures/falha-de-login.ts";

test("senha: diz o papel, onde a página ficou e o aviso da tela", () => {
  assert.equal(
    mensagemDaFalhaDeLogin({ papel: "admin", etapa: "senha", caminho: "/auth", aviso: "Muitas tentativas. Aguarde 42 s para tentar de novo." }),
    'login de "admin" parou no passo da senha: a página ficou em /auth e a tela disse "Muitas tentativas. Aguarde 42 s para tentar de novo."',
  );
  assert.equal(mensagemDaFalhaDeLogin({ papel: "inquilino", etapa: "senha", caminho: "/auth", aviso: null }), 'login de "inquilino" parou no passo da senha: a página ficou em /auth e a tela não mostrou aviso');
});

test("duas etapas: código recusado aponta para o segredo do ambiente", () => {
  const m = mensagemDaFalhaDeLogin({ papel: "admin", etapa: "duas-etapas", caminho: "/auth/verificar-codigo", aviso: "Código incorreto. Confira o app e tente de novo." });
  assert.match(m, /^login de "admin" parou no passo das duas etapas: a página ficou em \/auth\/verificar-codigo e a tela disse "Código incorreto\. Confira o app e tente de novo\."/);
  assert.match(m, /TESTES_ADMIN_TOTP_SEGREDO deste ambiente não é o do fator atual da conta/);
  assert.match(m, /semeado de novo/);
});

test("o aviso longo é cortado e fica numa linha (o global-setup imprime só a primeira)", () => {
  const m = mensagemDaFalhaDeLogin({ papel: "admin", etapa: "senha", caminho: "/auth", aviso: `linha um\nlinha dois ${"x".repeat(400)}` });
  assert.ok(!m.includes("\n"));
  assert.ok(m.length < 320);
});

test("o login da suíte usa a mensagem nos dois passos", () => {
  const auth = readFileSync("tests/e2e/fixtures/auth.ts", "utf8");
  assert.match(auth, /etapa: "senha"/);
  assert.match(auth, /etapa: "duas-etapas"/);
  // O código recusado é percebido pelo aviso da tela, sem esperar os 20 s do redirecionamento.
  assert.match(auth, /querySelectorAll\('\[role="alert"\]'\)/);
  assert.match(auth, /Promise\.race\(\[entrou, recusou\]\)/);
});

test("no laboratório, o global-setup zera o limite de login de cada persona antes de entrar", () => {
  // O login tem limite progressivo por e-mail (5 por minuto, 10 em 10 minutos, 20 por hora — limite-login.ts). Os specs
  // já zeravam o contador antes de entrar (entrarNaPagina); o global-setup não. Num laboratório reaproveitado, rodadas
  // seguidas estouravam o limite da persona que mais entra (o admin) e a rodada seguia sem a sessão dela.
  const gs = readFileSync("tests/e2e/global-setup.ts", "utf8");
  assert.match(gs, /if \(NO_LABORATORIO\) await liberarLimiteLogin\(account\(role\)\.email\);/);
  assert.ok(gs.indexOf("liberarLimiteLogin(account(role).email)") < gs.indexOf("await loginAs(page, role)"), "antes de cada tentativa de login");
  // Fora do laboratório (prévia, produção) não há chave de serviço: nada é zerado.
  assert.match(gs, /import \{ NO_LABORATORIO, liberarLimiteLogin \} from "\.\/fixtures\/laboratorio";/);
});

// ── E2E da prévia (ordem do Gerente, ronda de 06:55Z de 16/11): parar à primeira recusa por limite ─────────────────────
// Na prévia não há chave de serviço para zerar o limite de login. Todos os PRs usam as mesmas três contas contra o mesmo
// banco; cada rodada recusada repetia 3 vezes por conta e gastava 9 tentativas do limite, o que o mantinha estourado para
// a rodada seguinte (medido em produção, só leitura: 12 tentativas em 10 min por conta; o limite é 10).

test("recusa por limite: reconhece o aviso da tela nas duas redações do produto, e só ele", async () => {
  const { recusaPorLimite } = await import("../e2e/fixtures/falha-de-login.ts");
  assert.equal(recusaPorLimite('login de "admin" parou no passo da senha: a página ficou em /auth e a tela disse "Muitas tentativas. Aguarde um instante e tente de novo."'), true);
  assert.equal(recusaPorLimite('a tela disse "Muitas tentativas. Aguarde um pouco para tentar de novo."'), true);
  assert.equal(recusaPorLimite('a tela disse "muitas  tentativas"'), true);
  assert.equal(recusaPorLimite('login de "admin" parou no passo da senha: a página ficou em /auth e a tela disse "E-mail ou senha incorretos."'), false);
  assert.equal(recusaPorLimite("page.waitForURL: Timeout 20000ms exceeded."), false);
  assert.equal(recusaPorLimite(""), false);
});

test("comTentativas: com 'desistir', a recusa não é repetida (1 tentativa, sem pausa); as outras falhas seguem com 3", async () => {
  const { comTentativas } = await import("../e2e/fixtures/tentativas.ts");
  const semPausa = async () => undefined;
  let n = 0;
  const pausas: number[] = [];
  await assert.rejects(
    comTentativas(async () => { n++; throw new Error("Muitas tentativas"); }, 3, 2_000, async (ms) => { pausas.push(ms); }, (e) => /Muitas tentativas/.test((e as Error).message)),
    /Muitas tentativas/,
  );
  assert.equal(n, 1, "parou na primeira recusa");
  assert.deepEqual(pausas, [], "sem esperar para repetir");
  // Falha que não é recusa por limite: continua com as 3 tentativas de antes.
  n = 0;
  await assert.rejects(comTentativas(async () => { n++; throw new Error("Timeout"); }, 3, 2_000, semPausa, (e) => /Muitas tentativas/.test((e as Error).message)), /Timeout/);
  assert.equal(n, 3);
  // Sem 'desistir' (como era): 3 tentativas mesmo na recusa.
  n = 0;
  await assert.rejects(comTentativas(async () => { n++; throw new Error("Muitas tentativas"); }, 3, 2_000, semPausa), /Muitas tentativas/);
  assert.equal(n, 3);
  // Passou na segunda: devolve o valor.
  n = 0;
  assert.equal(await comTentativas(async () => { n++; if (n < 2) throw new Error("Timeout"); return "ok"; }, 3, 2_000, semPausa, () => false), "ok");
});

test("global-setup: fora do laboratório, a recusa por limite não é repetida e a mensagem diz quantas tentativas foram", () => {
  const gs = readFileSync("tests/e2e/global-setup.ts", "utf8");
  // No laboratório o limite é zerado antes de cada tentativa: repetir lá não gasta nada e continua valendo.
  assert.match(gs, /NO_LABORATORIO \? undefined : \(e\) => recusaPorLimite\(\(e as Error\)\.message\)/);
  assert.match(gs, /import \{ recusaPorLimite \} from "\.\/fixtures\/falha-de-login";/);
  // A linha do log não diz mais "depois de 3 tentativas" quando foi uma só.
  assert.doesNotMatch(gs, /falhou depois de 3 tentativas/);
  assert.match(gs, /falhou depois de \$\{tentativas\} tentativa/);
});
